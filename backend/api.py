from contextlib import closing
from datetime import datetime
from functools import wraps
import os
from pathlib import Path
import re
import sqlite3
import traceback

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import check_password_hash

try:
    from dotenv import load_dotenv

    FILE_PATH = Path(__file__).resolve()
    PROJECT_ROOT = FILE_PATH.parents[1]
    env_path = PROJECT_ROOT / '.env'
    load_dotenv(env_path)
except ImportError:
    FILE_PATH = Path(__file__).resolve()
    PROJECT_ROOT = FILE_PATH.parents[1]


env_db = os.getenv('CMMS_DB_PATH')
if env_db:
    # Normalize relative DB paths against the project root so the backend does
    # not create different SQLite files based on the current working directory.
    DB = Path(env_db) if os.path.isabs(env_db) else PROJECT_ROOT / env_db
else:
    DB = PROJECT_ROOT / 'cmms_database.db'
DB = str(Path(DB).resolve())

PORT = int(os.getenv('PORT', '5001'))
DEBUG = os.getenv('FLASK_DEBUG', '0') == '1'
ALLOW_UNSAFE_SQL = os.getenv('CMMS_ALLOW_UNSAFE_SQL', '0') == '1'
MAX_MID_LEVEL_MANAGERS = int(os.getenv('CMMS_MAX_MID_LEVEL_MANAGERS', '4'))
MAX_BASE_LEVEL_WORKERS = int(os.getenv('CMMS_MAX_BASE_LEVEL_WORKERS', '20'))

ROLE_LABELS = {
    'administrator': 'System Administrator',
    'mid_level_manager': 'Mid-level Manager',
    'executive_officer': 'Executive Officer',
    'base_level_worker': 'Base-level Worker'
}

WRITE_ROLES = {'administrator', 'mid_level_manager'}
REPORT_ROLES = {'administrator', 'executive_officer'}
ALLOWED_TABLES = {
    'Staff',
    'Building',
    'Room',
    'Activity',
    'Equipment',
    'MaintenanceRequest',
    'Maintenance_Log',
    'Chemical'
}


app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.getenv('FLASK_SECRET_KEY', 'cmms-demo-session-secret'),
    SESSION_PERMANENT=False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.getenv('SESSION_COOKIE_SECURE', '0') == '1'
)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})
app.logger.info('Using CMMS database at %s', DB)


def db():
    conn = sqlite3.connect(DB)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.row_factory = sqlite3.Row
    return conn


def query(q, params=()):
    conn = db()
    try:
        cursor = conn.execute(q, params)
        if cursor.description is not None:
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def fetch_count(q, params=()):
    rows = query(q, params)
    return rows[0]['cnt'] if rows else 0


def validate_table(name):
    if name not in ALLOWED_TABLES:
        raise ValueError('Invalid table name')


def get_table_meta(name):
    validate_table(name)
    with closing(db()) as conn:
        cursor = conn.execute(f'PRAGMA table_info({name})')
        info = cursor.fetchall()
    columns = [row[1] for row in info]
    pks = [row[1] for row in info if row[5] == 1]
    return columns, pks


def get_staff_role_limit(role):
    if role == 'Mid-Level Manager':
        return MAX_MID_LEVEL_MANAGERS
    if role == 'Base-Level Worker':
        return MAX_BASE_LEVEL_WORKERS
    return None


def validate_building_manager(manager_id):
    if manager_id in (None, ''):
        return

    rows = query(
        '''
        SELECT StaffID
        FROM Staff
        WHERE StaffID = ? AND Role = 'Mid-Level Manager'
        ''',
        (manager_id,)
    )
    if not rows:
        raise ValueError('Building manager must be a Mid-Level Manager')


def validate_staff_role_limit(role, current_staff_id=None):
    limit = get_staff_role_limit(role)
    if limit is None:
        return

    params = [role]
    sql = 'SELECT COUNT(*) AS cnt FROM Staff WHERE Role = ?'
    if current_staff_id:
        sql += ' AND StaffID <> ?'
        params.append(current_staff_id)

    count = fetch_count(sql, tuple(params))
    if count >= limit:
        raise ValueError(f'{role} limit reached ({limit})')


def get_authenticated_user():
    user_id = session.get('user_id')
    if not user_id:
        return None

    rows = query(
        '''
        SELECT UserID, Username, Role, DisplayName, IsActive, StaffID
        FROM Users
        WHERE UserID = ? AND IsActive = 1
        ''',
        (user_id,)
    )
    if not rows:
        session.clear()
        return None
    return rows[0]


def serialize_user(user):
    return {
        'userId': user['UserID'],
        'username': user['Username'],
        'role': user['Role'],
        'roleLabel': ROLE_LABELS.get(user['Role'], user['Role']),
        'displayName': user['DisplayName'],
        'staffId': user['StaffID']
    }


def role_set_required(allowed_roles):
    return roles_required(*sorted(allowed_roles))


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return view_func(*args, **kwargs)

    return wrapped


def roles_required(*allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(*args, **kwargs):
            user = get_authenticated_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if user['Role'] not in allowed_roles:
                return jsonify({'error': 'You do not have permission to perform this action'}), 403
            return view_func(*args, **kwargs)

        return wrapped

    return decorator


def strip_leading_sql_comments(sql):
    remainder = sql or ''
    while True:
        stripped = remainder.lstrip()
        if stripped.startswith('--'):
            newline = stripped.find('\n')
            remainder = '' if newline == -1 else stripped[newline + 1:]
            continue
        if stripped.startswith('/*'):
            comment_end = stripped.find('*/')
            if comment_end == -1:
                return stripped
            remainder = stripped[comment_end + 2:]
            continue
        return stripped


def normalize_sql(sql):
    statement = strip_leading_sql_comments(sql).strip()
    if statement.endswith(';'):
        statement = statement[:-1].strip()
    return statement


def is_safe_read_query(sql):
    statement = normalize_sql(sql)
    if not statement or ';' in statement:
        return False

    uppercase = statement.upper()
    if not uppercase.startswith(('SELECT', 'WITH')):
        return False

    blocked_tokens = (
        'INSERT',
        'UPDATE',
        'DELETE',
        'DROP',
        'ALTER',
        'CREATE',
        'PRAGMA',
        'ATTACH',
        'DETACH',
        'REPLACE',
        'VACUUM',
        'TRUNCATE'
    )
    return not any(re.search(rf'\b{token}\b', uppercase) for token in blocked_tokens)


def unsafe_sql_requested():
    return request.headers.get('X-CMMS-Unsafe-SQL', '0') == '1'


@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    user = get_authenticated_user()
    if not user:
        return jsonify({'authenticated': False})
    return jsonify({'authenticated': True, 'user': serialize_user(user)})


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    rows = query(
        '''
        SELECT UserID, Username, PasswordHash, Role, DisplayName, IsActive, StaffID
        FROM Users
        WHERE Username = ?
        ''',
        (username,)
    )
    if not rows:
        return jsonify({'error': 'Invalid username or password'}), 401

    user = rows[0]
    if not user['IsActive'] or not check_password_hash(user['PasswordHash'], password):
        return jsonify({'error': 'Invalid username or password'}), 401

    session.clear()
    session.permanent = False
    session['user_id'] = user['UserID']
    session['role'] = user['Role']

    return jsonify({'success': True, 'user': serialize_user(user)})


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/staff', methods=['GET'])
@login_required
def staff():
    rows = query(
        '''
        SELECT StaffID, Name, Role, Status, COALESCE(OfficeLocation, 'N/A') AS OfficeLocation
        FROM Staff
        '''
    )
    return jsonify(rows)


@app.route('/api/staff/with-building', methods=['GET'])
@role_set_required(REPORT_ROLES)
def staff_with_building():
    rows = query(
        '''
        SELECT
            s.StaffID,
            s.Name,
            s.Role,
            COALESCE(b.Name, 'N/A') AS Building
        FROM Staff s
        LEFT JOIN Building b ON s.OfficeBuildingID = b.BuildingID
        ORDER BY s.Name
        '''
    )
    return jsonify(rows)


@app.route('/api/activities', methods=['GET'])
@login_required
def activities():
    try:
        rows = query(
            '''
            SELECT
                a.ActivityID,
                a.Description,
                a.Type,
                a.StartDate,
                a.EndDate,
                oi.BuildingID,
                oi.RoomNumber,
                oi.AreaType,
                oi.AreaLabel,
                oi.IsUsableDuringActivity,
                oi.ImpactLevel,
                oi.ImpactNotes,
                CASE
                    WHEN oi.RoomNumber IS NOT NULL THEN 'Room ' || oi.RoomNumber
                    WHEN oi.AreaLabel IS NOT NULL AND TRIM(oi.AreaLabel) <> '' THEN oi.AreaLabel
                    ELSE oi.AreaType
                END AS AffectedArea
            FROM Activity a
            LEFT JOIN Occurs_In oi ON a.ActivityID = oi.ActivityID
            ORDER BY a.StartDate DESC
            '''
        )
        for row in rows:
            chemicals = query(
                '''
                SELECT c.ChemicalID, c.Name, c.HazardInfo
                FROM Used u
                JOIN Chemical c ON u.ChemicalID = c.ChemicalID
                WHERE u.ActivityID = ?
                ''',
                (row['ActivityID'],)
            )
            row['UsedChemicals'] = chemicals
        return jsonify(rows)
    except Exception as exc:
        print(f'Error in activities: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/requests', methods=['GET', 'POST'])
@login_required
def maintenance_requests():
    if request.method == 'GET':
        rows = query(
            '''
            SELECT RequestID, Title, Description, Priority, Status,
                   RequestedByStaffID, RequestDate
            FROM MaintenanceRequest
            ORDER BY RequestDate DESC
            '''
        )
        return jsonify(rows)

    user = get_authenticated_user()
    if user['Role'] not in WRITE_ROLES:
        return jsonify({'error': 'You do not have permission to create maintenance requests'}), 403

    data = request.json or {}
    requested_by = data.get('RequestedByStaffID') or user.get('StaffID')
    if not requested_by:
        return jsonify(
            {
                'error': (
                    'RequestedByStaffID is required. System administrator accounts are not '
                    'mapped to operational Staff records by default.'
                )
            }
        ), 400

    query(
        '''
        INSERT INTO MaintenanceRequest (Title, Description, Priority, Status, RequestedByStaffID, RequestDate)
        VALUES (?, ?, ?, ?, ?, ?)
        ''',
        (
            data['Title'],
            data['Description'],
            data['Priority'],
            'Pending',
            requested_by,
            datetime.now().strftime('%Y-%m-%d')
        )
    )
    return jsonify({'success': True})


@app.route('/api/equipment', methods=['GET'])
@login_required
def equipment():
    try:
        rows = query(
            '''
            SELECT
                e.EquipmentID,
                e.Name,
                e.Status,
                e.LastMaintenanceDate,
                latest_log.NextMaintenanceDate,
                COALESCE(last_location.Location, 'Unassigned') AS Location
            FROM Equipment e
            LEFT JOIN (
                SELECT
                    EquipmentID,
                    NextMaintenanceDate,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentID
                        ORDER BY MaintenanceDate DESC, LogID DESC
                    ) AS rn
                FROM Maintenance_Log
            ) latest_log ON latest_log.EquipmentID = e.EquipmentID AND latest_log.rn = 1
            LEFT JOIN (
                SELECT
                    ue.EquipmentID,
                    CASE
                        WHEN oi.RoomNumber IS NOT NULL THEN b.Name || ' / Room ' || oi.RoomNumber
                        WHEN oi.AreaLabel IS NOT NULL AND TRIM(oi.AreaLabel) <> '' THEN b.Name || ' / ' || oi.AreaLabel
                        ELSE b.Name || ' / ' || oi.AreaType
                    END AS Location,
                    ROW_NUMBER() OVER (
                        PARTITION BY ue.EquipmentID
                        ORDER BY a.StartDate DESC, a.ActivityID DESC
                    ) AS rn
                FROM Uses_Equipment ue
                JOIN Activity a ON ue.ActivityID = a.ActivityID
                JOIN Occurs_In oi ON a.ActivityID = oi.ActivityID
                JOIN Building b ON oi.BuildingID = b.BuildingID
            ) last_location ON last_location.EquipmentID = e.EquipmentID AND last_location.rn = 1
            ORDER BY e.EquipmentID
            '''
        )
        return jsonify(rows)
    except Exception as exc:
        print(f'Error in equipment: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/logs', methods=['GET', 'POST'])
@login_required
def logs():
    if request.method == 'GET':
        eq_id = request.args.get('equipment')
        if eq_id:
            rows = query(
                '''
                SELECT LogID, Description, MaintenanceDate AS Date, NextMaintenanceDate
                FROM Maintenance_Log
                WHERE EquipmentID = ?
                ORDER BY MaintenanceDate DESC, LogID DESC
                ''',
                (eq_id,)
            )
        else:
            rows = query(
                '''
                SELECT LogID, Description, MaintenanceDate AS Date, NextMaintenanceDate
                FROM Maintenance_Log
                ORDER BY MaintenanceDate DESC, LogID DESC
                LIMIT 10
                '''
            )
        return jsonify(rows)

    user = get_authenticated_user()
    if user['Role'] not in WRITE_ROLES:
        return jsonify({'error': 'You do not have permission to create maintenance logs'}), 403

    try:
        data = request.json or {}
        query(
            '''
            INSERT INTO Maintenance_Log (MaintenanceDate, Description, NextMaintenanceDate, EquipmentID, StaffID)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (
                data.get('MaintenanceDate', datetime.now().strftime('%Y-%m-%d')),
                data.get('Description', ''),
                data.get('NextMaintenanceDate'),
                data.get('EquipmentID'),
                data.get('StaffID') or user.get('StaffID')
            )
        )
        return jsonify({'success': True})
    except sqlite3.IntegrityError:
        return jsonify(
            {
                'error': (
                    'StaffID is required for maintenance logs. System administrator accounts are '
                    'not linked to operational Staff records by default.'
                )
            }
        ), 400
    except Exception as exc:
        print(f'Error creating log: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/dashboard', methods=['GET'])
@login_required
def dashboard():
    try:
        staff_count = fetch_count('SELECT COUNT(*) as cnt FROM Staff WHERE Status = ?', ('Active',))
        req_count = fetch_count(
            'SELECT COUNT(*) as cnt FROM MaintenanceRequest WHERE Status = ?',
            ('Pending',)
        )
        overdue_count = fetch_count(
            '''
            SELECT COUNT(*) AS cnt
            FROM Equipment e
            JOIN (
                SELECT
                    EquipmentID,
                    NextMaintenanceDate,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentID
                        ORDER BY MaintenanceDate DESC, LogID DESC
                    ) AS rn
                FROM Maintenance_Log
                WHERE NextMaintenanceDate IS NOT NULL
            ) latest ON latest.EquipmentID = e.EquipmentID AND latest.rn = 1
            WHERE date(latest.NextMaintenanceDate) < date('now')
              AND e.Status = 'Available'
            '''
        )

        return jsonify(
            {
                'activeStaff': staff_count,
                'pendingRequests': req_count,
                'overdueEquipment': overdue_count
            }
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/query', methods=['POST'])
@roles_required('administrator')
def sql_query():
    data = request.json or {}
    sql = data.get('sql', '').strip()
    if not sql:
        return jsonify({'error': 'SQL query required'}), 400

    safe_read_query = is_safe_read_query(sql)
    if not safe_read_query:
        if not (ALLOW_UNSAFE_SQL and unsafe_sql_requested()):
            return jsonify(
                {
                    'error': (
                        'Only read-only SELECT queries are allowed by default. '
                        'Unsafe SQL requires administrator access, CMMS_ALLOW_UNSAFE_SQL=1, '
                        'and the X-CMMS-Unsafe-SQL header.'
                    )
                }
            ), 403

    try:
        result = query(sql)
        if isinstance(result, list):
            return jsonify(result)
        return jsonify({'rows_affected': result, 'message': 'Query executed successfully'})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400


@app.route('/api/query-table', methods=['GET'])
@login_required
def table():
    try:
        table_name = request.args.get('table', '')
        search_term = request.args.get('search', '')
        search_column = request.args.get('column', '')
        meta_only = request.args.get('metaOnly', 'false').lower() == 'true'

        if not table_name:
            return jsonify({'error': 'Table name is required'}), 400

        try:
            cols, pks = get_table_meta(table_name)
        except ValueError as err:
            return jsonify({'error': str(err)}), 400

        if meta_only:
            rows = []
        elif search_term:
            if search_column and search_column in cols:
                where_clause = f'{search_column} LIKE ?'
                params = (f'%{search_term}%',)
            else:
                where_clause = ' OR '.join([f'{col} LIKE ?' for col in cols])
                params = tuple([f'%{search_term}%'] * len(cols))
            rows = query(f'SELECT * FROM {table_name} WHERE {where_clause} LIMIT 100', params)
        else:
            rows = query(f'SELECT * FROM {table_name} LIMIT 100')

        return jsonify({'columns': cols, 'primaryKeys': pks, 'data': rows})
    except Exception as exc:
        print(f'Error in table: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/table-update', methods=['POST'])
@roles_required('administrator', 'mid_level_manager')
def update():
    try:
        data = request.json or {}
        table_name = data.get('table', '')
        record_data = data.get('data', {})
        pk = data.get('primaryKey', {})

        if not table_name or not record_data or not pk:
            return jsonify({'error': 'Table name, data, and primary key are required'}), 400

        try:
            cols, pks = get_table_meta(table_name)
        except ValueError as err:
            return jsonify({'error': str(err)}), 400

        filtered = {k: v for k, v in record_data.items() if v is not None and str(v).strip() != ''}
        unknown_fields = [k for k in filtered.keys() if k not in cols]
        if unknown_fields:
            return jsonify({'error': f'Unknown columns: {", ".join(unknown_fields)}'}), 400

        if table_name == 'Building' and 'ManagerID' in filtered:
            validate_building_manager(filtered.get('ManagerID'))
        if table_name == 'Staff' and 'Role' in filtered:
            current_staff_id = pk.get('StaffID') if isinstance(pk, dict) else None
            validate_staff_role_limit(filtered['Role'], current_staff_id=current_staff_id)

        if table_name == 'Room':
            if 'BuildingID' not in pk or 'RoomNumber' not in pk:
                return jsonify({'error': 'Room requires BuildingID and RoomNumber in primary key'}), 400
            set_clause = ', '.join([f'{k} = ?' for k in filtered.keys()])
            where_clause = 'BuildingID = ? AND RoomNumber = ?'
            params = tuple(filtered.values()) + (pk['BuildingID'], pk['RoomNumber'])
        else:
            pk_col = list(pk.keys())[0] if pk else None
            if not pk_col:
                return jsonify({'error': 'Primary key is required'}), 400
            if pk_col in filtered:
                filtered.pop(pk_col)
            if pk_col not in pks:
                return jsonify({'error': f'{pk_col} is not a primary key of {table_name}'}), 400
            set_clause = ', '.join([f'{k} = ?' for k in filtered.keys()])
            where_clause = f'{pk_col} = ?'
            params = tuple(filtered.values()) + (pk[pk_col],)

        if not set_clause:
            return jsonify({'error': 'No fields to update'}), 400

        rows = query(f'UPDATE {table_name} SET {set_clause} WHERE {where_clause}', params)
        return jsonify(
            {
                'success': True,
                'message': f'Successfully updated {rows} record(s)',
                'rows_affected': rows
            }
        )
    except ValueError as err:
        return jsonify({'error': str(err)}), 400
    except Exception as exc:
        print(f'Error in update: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/table-delete', methods=['POST'])
@roles_required('administrator', 'mid_level_manager')
def delete():
    try:
        data = request.json or {}
        table_name = data.get('table', '')
        pk = data.get('primaryKey', {})

        if not table_name or not pk:
            return jsonify({'error': 'Table name and primary key are required'}), 400

        try:
            _, pks = get_table_meta(table_name)
        except ValueError as err:
            return jsonify({'error': str(err)}), 400

        if table_name == 'Room':
            if 'BuildingID' not in pk or 'RoomNumber' not in pk:
                return jsonify({'error': 'Room requires BuildingID and RoomNumber in primary key'}), 400
            q = f'DELETE FROM {table_name} WHERE BuildingID = ? AND RoomNumber = ?'
            params = (pk['BuildingID'], pk['RoomNumber'])
        else:
            pk_col = list(pk.keys())[0] if pk else None
            if not pk_col:
                return jsonify({'error': 'Primary key is required'}), 400
            if pk_col not in pks:
                return jsonify({'error': f'{pk_col} is not a primary key of {table_name}'}), 400
            q = f'DELETE FROM {table_name} WHERE {pk_col} = ?'
            params = (pk[pk_col],)

        rows = query(q, params)
        return jsonify(
            {
                'success': True,
                'message': f'Successfully deleted {rows} record(s)',
                'rows_affected': rows
            }
        )
    except Exception as exc:
        print(f'Error in delete: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/table-insert', methods=['POST'])
@roles_required('administrator', 'mid_level_manager')
def table_insert():
    try:
        data = request.json or {}
        table_name = data.get('table', '')
        rows = data.get('rows', [])

        if not table_name or not rows:
            return jsonify({'error': 'Table name and rows are required'}), 400
        if isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list) or not rows:
            return jsonify({'error': 'Rows must be a non-empty array'}), 400

        cols, _ = get_table_meta(table_name)
        cleaned_rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            filtered = {k: v for k, v in row.items() if k in cols and v not in (None, '')}
            if filtered:
                cleaned_rows.append(filtered)

        if not cleaned_rows:
            return jsonify({'error': 'No valid data to insert'}), 400

        conn = db()
        try:
            if table_name == 'Staff':
                role_batch_counts = {}
                for row in cleaned_rows:
                    role = row.get('Role')
                    if role:
                        role_batch_counts[role] = role_batch_counts.get(role, 0) + 1

                for role, batch_count in role_batch_counts.items():
                    limit = get_staff_role_limit(role)
                    if limit is None:
                        continue
                    current_count = fetch_count(
                        'SELECT COUNT(*) AS cnt FROM Staff WHERE Role = ?',
                        (role,)
                    )
                    if current_count + batch_count > limit:
                        raise ValueError(f'{role} limit reached ({limit})')

            grouped_rows = {}
            for row in cleaned_rows:
                if table_name == 'Building' and 'ManagerID' in row:
                    validate_building_manager(row.get('ManagerID'))

                column_order = tuple(column for column in cols if column in row)
                grouped_rows.setdefault(column_order, []).append(row)

            for column_order, row_group in grouped_rows.items():
                keys = ', '.join(column_order)
                row_placeholders = '(' + ', '.join(['?'] * len(column_order)) + ')'
                values_clause = ', '.join([row_placeholders] * len(row_group))
                params = []
                for row in row_group:
                    params.extend(row[column] for column in column_order)

                conn.execute(
                    f'INSERT INTO {table_name} ({keys}) VALUES {values_clause}',
                    tuple(params)
                )
            conn.commit()
        finally:
            conn.close()

        return jsonify(
            {
                'success': True,
                'message': f'Inserted {len(cleaned_rows)} record(s) using batch SQL',
                'rows_affected': len(cleaned_rows)
            }
        )
    except ValueError as err:
        return jsonify({'error': str(err)}), 400
    except Exception as exc:
        print(f'Error in table_insert: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/activities/find', methods=['POST'])
@login_required
def find_activities():
    try:
        data = request.json or {}
        start = data.get('startDate')
        end = data.get('endDate')
        buildings = data.get('buildings', [])

        if not start or not end:
            return jsonify({'error': 'startDate and endDate are required'}), 400

        query_str = '''
            SELECT
                a.ActivityID,
                a.Description,
                a.Type,
                a.StartDate,
                a.EndDate,
                b.BuildingID,
                b.Name AS BuildingName,
                oi.RoomNumber,
                oi.AreaType,
                oi.AreaLabel,
                oi.IsUsableDuringActivity,
                oi.ImpactLevel,
                oi.ImpactNotes,
                CASE
                    WHEN oi.RoomNumber IS NOT NULL THEN 'Room ' || oi.RoomNumber
                    WHEN oi.AreaLabel IS NOT NULL AND TRIM(oi.AreaLabel) <> '' THEN oi.AreaLabel
                    ELSE oi.AreaType
                END AS AffectedArea,
                GROUP_CONCAT(DISTINCT (
                    CASE
                        WHEN c.Name IS NOT NULL
                        THEN c.Name || COALESCE(' (' || c.HazardInfo || ')', '')
                        ELSE NULL
                    END
                )) AS Chemicals
            FROM Activity a
            JOIN Occurs_In oi ON a.ActivityID = oi.ActivityID
            JOIN Building b ON oi.BuildingID = b.BuildingID
            LEFT JOIN Used u ON a.ActivityID = u.ActivityID
            LEFT JOIN Chemical c ON u.ChemicalID = c.ChemicalID
            WHERE (a.StartDate <= ? AND a.EndDate >= ?)
        '''
        params = [end, start]

        if buildings:
            placeholders = ','.join(['?'] * len(buildings))
            query_str += f' AND oi.BuildingID IN ({placeholders})'
            params.extend(buildings)

        query_str += ' GROUP BY a.ActivityID, oi.BuildingID, oi.RoomNumber ORDER BY a.StartDate ASC'

        rows = query(query_str, params)
        return jsonify(rows)
    except Exception as exc:
        print(f'Error in find_activities: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/cleaning/find', methods=['POST'])
@login_required
def find_cleaning_activities():
    try:
        data = request.json or {}
        start = data.get('startDate')
        end = data.get('endDate')
        buildings = data.get('buildings', [])

        if not start or not end:
            return jsonify({'error': 'startDate and endDate are required'}), 400

        query_str = '''
            SELECT
                a.ActivityID,
                a.Description,
                a.Type,
                a.StartDate,
                a.EndDate,
                b.BuildingID,
                b.Name AS BuildingName,
                oi.RoomNumber,
                oi.AreaType,
                oi.AreaLabel,
                oi.IsUsableDuringActivity,
                oi.ImpactLevel,
                oi.ImpactNotes,
                CASE
                    WHEN oi.RoomNumber IS NOT NULL THEN 'Room ' || oi.RoomNumber
                    WHEN oi.AreaLabel IS NOT NULL AND TRIM(oi.AreaLabel) <> '' THEN oi.AreaLabel
                    ELSE oi.AreaType
                END AS AffectedArea,
                GROUP_CONCAT(DISTINCT (
                    CASE
                        WHEN c.HazardInfo IS NOT NULL AND TRIM(c.HazardInfo) <> ''
                        THEN c.Name || ' (' || c.HazardInfo || ')'
                        ELSE NULL
                    END
                )) AS HarmfulChemicals
            FROM Activity a
            JOIN Occurs_In oi ON a.ActivityID = oi.ActivityID
            JOIN Building b ON oi.BuildingID = b.BuildingID
            LEFT JOIN Used u ON a.ActivityID = u.ActivityID
            LEFT JOIN Chemical c ON u.ChemicalID = c.ChemicalID
            WHERE a.Type = 'Daily Cleaning'
              AND a.StartDate <= ?
              AND a.EndDate >= ?
        '''
        params = [end, start]

        if buildings:
            placeholders = ','.join(['?'] * len(buildings))
            query_str += f' AND oi.BuildingID IN ({placeholders})'
            params.extend(buildings)

        query_str += '''
            GROUP BY
                a.ActivityID,
                b.BuildingID,
                b.Name,
                oi.RoomNumber,
                oi.AreaType,
                oi.AreaLabel,
                oi.IsUsableDuringActivity,
                oi.ImpactLevel,
                oi.ImpactNotes
            ORDER BY a.StartDate ASC, b.Name ASC
        '''

        rows = query(query_str, params)
        return jsonify(rows)
    except Exception as exc:
        print(f'Error in find_cleaning_activities: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/reports/staff-summary', methods=['GET'])
@role_set_required(REPORT_ROLES)
def staff_summary():
    summary = query(
        '''
        SELECT
            COUNT(*) AS Total,
            SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) AS Active
        FROM Staff
        '''
    )[0]
    by_role = query(
        '''
        SELECT Role, COUNT(*) AS Count
        FROM Staff
        GROUP BY Role
        ORDER BY Role
        '''
    )
    return jsonify(
        {
            'total': summary['Total'],
            'active': summary['Active'] or 0,
            'byRole': [{'role': row['Role'], 'count': row['Count']} for row in by_role]
        }
    )


@app.route('/api/reports/building-utilization', methods=['GET'])
@role_set_required(REPORT_ROLES)
def building_utilization():
    building_count = fetch_count('SELECT COUNT(*) AS cnt FROM Building')
    room_summary = query(
        'SELECT COUNT(*) AS RoomCount, COALESCE(SUM(Capacity), 0) AS TotalCapacity FROM Room'
    )[0]
    by_building = query(
        '''
        SELECT
            b.BuildingID,
            b.Name AS BuildingName,
            COUNT(r.RoomNumber) AS RoomCount,
            COALESCE(SUM(r.Capacity), 0) AS TotalCapacity
        FROM Building b
        LEFT JOIN Room r ON b.BuildingID = r.BuildingID
        GROUP BY b.BuildingID, b.Name
        ORDER BY b.Name
        '''
    )
    return jsonify(
        {
            'buildings': building_count,
            'rooms': room_summary['RoomCount'],
            'totalCapacity': room_summary['TotalCapacity'],
            'byBuilding': by_building
        }
    )


@app.route('/api/reports/chemical-summary', methods=['GET'])
@role_set_required(REPORT_ROLES)
def chemical_summary():
    summary = query(
        '''
        SELECT
            COUNT(*) AS Total,
            SUM(CASE WHEN HazardInfo IS NOT NULL AND TRIM(HazardInfo) <> '' THEN 1 ELSE 0 END) AS Hazardous
        FROM Chemical
        '''
    )[0]
    return jsonify({'total': summary['Total'], 'hazardous': summary['Hazardous'] or 0})


@app.route('/api/reports/activity-summary', methods=['GET'])
@role_set_required(REPORT_ROLES)
def activity_summary():
    summary = query(
        '''
        SELECT
            COUNT(*) AS Total,
            SUM(
                CASE
                    WHEN date(StartDate) <= date('now')
                     AND date(COALESCE(EndDate, StartDate)) >= date('now')
                    THEN 1 ELSE 0
                END
            ) AS InProgress,
            SUM(CASE WHEN date(StartDate) > date('now') THEN 1 ELSE 0 END) AS Upcoming
        FROM Activity
        '''
    )[0]
    by_type = query(
        '''
        SELECT Type AS ActivityType, COUNT(*) AS Count
        FROM Activity
        GROUP BY Type
        ORDER BY Count DESC, Type ASC
        '''
    )
    by_building = query(
        '''
        SELECT
            b.BuildingID,
            b.Name AS BuildingName,
            COUNT(DISTINCT oi.ActivityID) AS ActivityCount
        FROM Building b
        LEFT JOIN Occurs_In oi ON b.BuildingID = oi.BuildingID
        GROUP BY b.BuildingID, b.Name
        ORDER BY ActivityCount DESC, b.Name ASC
        '''
    )
    return jsonify(
        {
            'total': summary['Total'],
            'inProgress': summary['InProgress'] or 0,
            'upcoming': summary['Upcoming'] or 0,
            'byType': by_type,
            'byBuilding': by_building
        }
    )


@app.route('/api/reports/workforce-allocation', methods=['GET'])
@role_set_required(REPORT_ROLES)
def workforce_allocation():
    try:
        rows = query(
            '''
            SELECT
                b.BuildingID,
                b.Name AS BuildingName,
                a.Type AS ActivityType,
                COUNT(DISTINCT p.StaffID) AS WorkerCount
            FROM Performs p
            JOIN Activity a ON p.ActivityID = a.ActivityID
            JOIN Occurs_In oi ON a.ActivityID = oi.ActivityID
            JOIN Building b ON oi.BuildingID = b.BuildingID
            GROUP BY b.BuildingID, b.Name, a.Type
            ORDER BY b.Name, a.Type
            '''
        )
        return jsonify(rows)
    except Exception as exc:
        print(f'Error in workforce_allocation: {traceback.format_exc()}')
        return jsonify({'error': str(exc)}), 500


@app.route('/api/reports/request-priority-distribution', methods=['GET'])
@role_set_required(REPORT_ROLES)
def request_priority_distribution():
    rows = query(
        '''
        SELECT Priority, COUNT(*) AS RequestCount
        FROM MaintenanceRequest
        GROUP BY Priority
        ORDER BY RequestCount DESC, Priority ASC
        '''
    )
    return jsonify(rows)


@app.route('/api/reports/overdue-equipment-by-type', methods=['GET'])
@role_set_required(REPORT_ROLES)
def overdue_equipment_by_type():
    rows = query(
        '''
        SELECT
            e.Type AS EquipmentType,
            COUNT(*) AS OverdueCount
        FROM Equipment e
        JOIN (
            SELECT
                EquipmentID,
                NextMaintenanceDate,
                ROW_NUMBER() OVER (
                    PARTITION BY EquipmentID
                    ORDER BY MaintenanceDate DESC, LogID DESC
                ) AS rn
            FROM Maintenance_Log
            WHERE NextMaintenanceDate IS NOT NULL
        ) latest ON latest.EquipmentID = e.EquipmentID AND latest.rn = 1
        WHERE date(latest.NextMaintenanceDate) < date('now')
        GROUP BY e.Type
        ORDER BY OverdueCount DESC, EquipmentType ASC
        '''
    )
    return jsonify(rows)


if __name__ == '__main__':
    app.run(debug=DEBUG, port=PORT)
