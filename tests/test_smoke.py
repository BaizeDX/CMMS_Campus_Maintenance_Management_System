import importlib.util
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import uuid


PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_PATH = PROJECT_ROOT / 'backend' / 'api.py'
INIT_DB_SCRIPT = PROJECT_ROOT / 'scripts' / 'init_db.py'


def load_api_module():
    module_name = f'cmms_api_{uuid.uuid4().hex}'
    spec = importlib.util.spec_from_file_location(module_name, API_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class BackendConfigurationTests(unittest.TestCase):
    def test_relative_db_path_resolves_from_project_root(self):
        original_env = os.environ.get('CMMS_DB_PATH')
        original_cwd = os.getcwd()
        try:
            os.environ['CMMS_DB_PATH'] = 'tmp/relative-test.db'
            os.chdir('/tmp')
            module = load_api_module()
            expected = str((PROJECT_ROOT / 'tmp' / 'relative-test.db').resolve())
            self.assertEqual(module.DB, expected)
        finally:
            os.chdir(original_cwd)
            if original_env is None:
                os.environ.pop('CMMS_DB_PATH', None)
            else:
                os.environ['CMMS_DB_PATH'] = original_env

    def test_backend_cwd_does_not_redirect_cmms_database_db_into_backend(self):
        backend_dir = PROJECT_ROOT / 'backend'
        expected = str((PROJECT_ROOT / 'cmms_database.db').resolve())
        possible_wrong_path = backend_dir / 'cmms_database.db'

        env = os.environ.copy()
        env['CMMS_DB_PATH'] = 'cmms_database.db'

        result = subprocess.run(
            [
                sys.executable,
                '-c',
                'import api; print(api.DB)'
            ],
            cwd=backend_dir,
            env=env,
            check=True,
            capture_output=True,
            text=True
        )

        resolved = result.stdout.strip()
        self.assertEqual(resolved, expected)
        self.assertNotEqual(resolved, str(possible_wrong_path.resolve()))
        self.assertFalse(possible_wrong_path.exists())


class BackendSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.db_path = Path(cls.temp_dir.name) / 'cmms_test.db'

        subprocess.run(
            [
                sys.executable,
                str(INIT_DB_SCRIPT),
                '--force',
                '--seed',
                '--db',
                str(cls.db_path)
            ],
            check=True
        )

        os.environ['CMMS_DB_PATH'] = str(cls.db_path)
        cls.api = load_api_module()
        cls.app = cls.api.app

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        os.environ.pop('CMMS_DB_PATH', None)

    def setUp(self):
        self.client = self.app.test_client()

    def login(self, username, password):
        return self.client.post(
            '/api/auth/login',
            json={'username': username, 'password': password}
        )

    def logout(self):
        return self.client.post('/api/auth/logout')

    def test_init_db_creates_demo_users_and_triggers(self):
        conn = sqlite3.connect(self.db_path)
        try:
            user_count = conn.execute('SELECT COUNT(*) FROM Users').fetchone()[0]
            admin_user = conn.execute(
                "SELECT Role, StaffID FROM Users WHERE Username = 'admin'"
            ).fetchone()
            trigger_rows = conn.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'trigger'
                ORDER BY name
                """
            ).fetchall()
        finally:
            conn.close()

        self.assertGreaterEqual(user_count, 4)
        self.assertEqual(admin_user[0], 'administrator')
        self.assertIsNone(admin_user[1])
        trigger_names = {row[0] for row in trigger_rows}
        self.assertIn('admin_user_insert_guard', trigger_names)
        self.assertIn('admin_user_update_guard', trigger_names)
        self.assertIn('emergency_maintenance_alert', trigger_names)
        self.assertIn('update_equipment_after_maintenance', trigger_names)
        self.assertIn('building_manager_insert_guard', trigger_names)
        self.assertIn('building_manager_update_guard', trigger_names)
        self.assertIn('building_manager_role_change_guard', trigger_names)

    def test_dashboard_requires_login(self):
        response = self.client.get('/api/dashboard')
        self.assertEqual(response.status_code, 401)

    def test_login_success_and_failure(self):
        success = self.login('admin', 'admin123')
        self.assertEqual(success.status_code, 200)
        self.assertTrue(success.get_json()['success'])
        self.assertIsNone(success.get_json()['user']['staffId'])

        failure = self.client.post(
            '/api/auth/login',
            json={'username': 'admin', 'password': 'wrong-password'}
        )
        self.assertEqual(failure.status_code, 401)

    def test_session_is_non_permanent_and_logout_clears_auth(self):
        self.assertFalse(self.app.config['SESSION_PERMANENT'])

        self.login('admin', 'admin123')
        with self.client.session_transaction() as sess:
            self.assertFalse(sess.permanent)

        me_response = self.client.get('/api/auth/me')
        self.assertTrue(me_response.get_json()['authenticated'])

        logout_response = self.logout()
        self.assertEqual(logout_response.status_code, 200)

        me_after_logout = self.client.get('/api/auth/me')
        self.assertFalse(me_after_logout.get_json()['authenticated'])

    def test_admin_can_run_read_only_sql_but_unsafe_sql_is_blocked_by_default(self):
        login_response = self.login('admin', 'admin123')
        self.assertEqual(login_response.status_code, 200)

        select_response = self.client.post(
            '/api/query',
            json={'sql': 'SELECT COUNT(*) AS cnt FROM Staff;'}
        )
        self.assertEqual(select_response.status_code, 200)
        self.assertEqual(select_response.get_json()[0]['cnt'], 15)

        delete_response = self.client.post(
            '/api/query',
            json={'sql': 'DELETE FROM Chemical WHERE ChemicalID = 1;'}
        )
        self.assertEqual(delete_response.status_code, 403)

    def test_manager_can_insert_but_worker_cannot_delete(self):
        login_response = self.login('manager', 'manager123')
        self.assertEqual(login_response.status_code, 200)

        insert_response = self.client.post(
            '/api/table-insert',
            json={
                'table': 'Chemical',
                'rows': [{'Name': 'Portfolio Cleaner', 'HazardInfo': 'Use gloves'}]
            }
        )
        self.assertEqual(insert_response.status_code, 200)
        self.logout()

        self.login('worker', 'worker123')
        delete_response = self.client.post(
            '/api/table-delete',
            json={
                'table': 'Chemical',
                'primaryKey': {'ChemicalID': 1}
            }
        )
        self.assertEqual(delete_response.status_code, 403)

    def test_low_privilege_user_cannot_access_admin_sql_runner(self):
        self.login('worker', 'worker123')
        response = self.client.post(
            '/api/query',
            json={'sql': 'SELECT COUNT(*) AS cnt FROM Staff;'}
        )
        self.assertEqual(response.status_code, 403)

    def test_report_endpoints_and_auth_me_shape(self):
        me_response = self.client.get('/api/auth/me')
        self.assertEqual(me_response.status_code, 200)
        self.assertFalse(me_response.get_json()['authenticated'])

        self.login('executive', 'executive123')
        report_response = self.client.get('/api/reports/staff-summary')
        self.assertEqual(report_response.status_code, 200)
        payload = report_response.get_json()
        self.assertIn('total', payload)
        self.assertIn('byRole', payload)

        self.logout()
        self.login('admin', 'admin123')
        admin_report = self.client.get('/api/reports/staff-summary')
        self.assertEqual(admin_report.status_code, 200)

        self.logout()
        self.login('worker', 'worker123')
        blocked_report = self.client.get('/api/reports/staff-summary')
        self.assertEqual(blocked_report.status_code, 403)

    def test_bulk_insert_endpoint_accepts_multiple_rows(self):
        self.login('manager', 'manager123')
        response = self.client.post(
            '/api/table-insert',
            json={
                'table': 'Chemical',
                'rows': [
                    {'Name': 'Batch Cleaner A', 'HazardInfo': 'Keep ventilated'},
                    {'Name': 'Batch Cleaner B', 'HazardInfo': 'Wear gloves'}
                ]
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('batch SQL', response.get_json()['message'])

        conn = sqlite3.connect(self.db_path)
        try:
            count = conn.execute(
                "SELECT COUNT(*) FROM Chemical WHERE Name IN ('Batch Cleaner A', 'Batch Cleaner B')"
            ).fetchone()[0]
        finally:
            conn.close()
        self.assertEqual(count, 2)

    def test_cleaning_search_returns_cleaning_only_with_impact_fields(self):
        self.login('worker', 'worker123')
        response = self.client.post(
            '/api/cleaning/find',
            json={
                'startDate': '2024-11-20',
                'endDate': '2024-11-25',
                'buildings': [4]
            }
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertGreaterEqual(len(payload), 1)

        first = payload[0]
        self.assertEqual(first['Type'], 'Daily Cleaning')
        self.assertIn('AffectedArea', first)
        self.assertIn('ImpactLevel', first)
        self.assertIn('IsUsableDuringActivity', first)
        self.assertIn('HarmfulChemicals', first)


if __name__ == '__main__':
    unittest.main()
