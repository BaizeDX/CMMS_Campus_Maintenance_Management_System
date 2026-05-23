import argparse
import sqlite3
import random
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'cmms_database.db'
)

def parse_args():
    parser = argparse.ArgumentParser(
        description='Populate the CMMS database with sample data.'
    )
    parser.add_argument(
        '--db',
        default=os.environ.get('CMMS_DB_PATH', DEFAULT_DB_PATH),
        help='Path to the SQLite database file.'
    )
    return parser.parse_args()


def get_db(db_path):
    return sqlite3.connect(db_path)

def clear_tables(conn):
    tables = ['Maintenance_Log', 'Request_Assignment', 'Uses_Equipment', 'Performs', 
              'Used', 'Occurs_In', 'MaintenanceRequest', 'Activity', 'Equipment',
              'Room', 'Users', 'Building', 'Staff', 'Chemical', 'Supplier', 'ExternalCompany']
    for table in tables:
        try:
            conn.execute(f'DELETE FROM {table}')
        except:
            pass
    conn.commit()

def seed_data(db_path):
    conn = get_db(db_path)
    cursor = conn.cursor()
    
    clear_tables(conn)
    
    buildings = [
        ('Core Building', 'Main Campus, Block A'),
        ('Engineering Tower', 'North Campus, Block B'),
        ('Science Complex', 'East Campus, Block C'),
        ('Student Center', 'Central Campus, Block D'),
        ('Library Building', 'Main Campus, Block E'),
        ('Sports Complex', 'West Campus, Block F'),
        ('Administration Block', 'Central Campus, Block G'),
        ('Residence Hall A', 'South Campus, Block H')
    ]
    
    cursor.executemany('INSERT INTO Building (BuildingID, Name, Location) VALUES (?, ?, ?)',
                      [(i+1, name, location) for i, (name, location) in enumerate(buildings)])
    
    staff_names = [
        ('Dr. Sarah Chen', 'Executive Officer', 'Active'),
        ('Prof. Michael Wong', 'Mid-Level Manager', 'Active'),
        ('Ms. Emily Liu', 'Mid-Level Manager', 'Active'),
        ('Mr. David Zhang', 'Base-Level Worker', 'Active'),
        ('Ms. Lisa Wang', 'Base-Level Worker', 'Active'),
        ('Mr. James Lee', 'Base-Level Worker', 'Active'),
        ('Ms. Anna Tan', 'Base-Level Worker', 'Active'),
        ('Mr. Robert Kim', 'Base-Level Worker', 'Active'),
        ('Ms. Grace Ho', 'Base-Level Worker', 'Active'),
        ('Mr. Tom Ng', 'Base-Level Worker', 'Active'),
        ('Ms. Mary Lam', 'Base-Level Worker', 'Active'),
        ('Mr. Peter Chan', 'Base-Level Worker', 'Active'),
        ('Ms. Susan Yip', 'Base-Level Worker', 'Active'),
        ('Mr. Kevin Cheung', 'Base-Level Worker', 'Active'),
        ('Ms. Jenny Lau', 'Base-Level Worker', 'Active')
    ]
    
    staff_data = []
    for i, (name, role, status) in enumerate(staff_names):
        email = name.lower().replace(' ', '.').replace("'", '').replace('.', '') + '@campus-demo.edu'
        phone = f'852-{3400 + i:06d}'
        office_loc = f'Building {((i+1) % 8) + 1}-Room {100+i}'
        supervisor = None if role == 'Executive Officer' else (1 if i < 3 else 2)
        contact_info = f'Email: {email}, Phone: {phone}'
        staff_data.append((i+1, name, role, contact_info, email, phone, status, ((i+1) % 8) + 1, office_loc, supervisor))
    
    cursor.executemany('INSERT INTO Staff (StaffID, Name, Role, ContactInfo, Email, PhoneNumber, Status, OfficeBuildingID, OfficeLocation, SupervisorID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', staff_data)

    demo_users = [
        ('admin', generate_password_hash('admin123'), 'administrator', 'System Administrator', 1, None),
        ('manager', generate_password_hash('manager123'), 'mid_level_manager', 'Mid-level Manager', 1, 2),
        ('executive', generate_password_hash('executive123'), 'executive_officer', 'Executive Officer', 1, 1),
        ('worker', generate_password_hash('worker123'), 'base_level_worker', 'Base-level Worker', 1, 4)
    ]
    cursor.executemany(
        'INSERT INTO Users (Username, PasswordHash, Role, DisplayName, IsActive, StaffID) VALUES (?, ?, ?, ?, ?, ?)',
        demo_users
    )
    
    building_managers = {
        1: 2,
        2: 3,
        3: 2,
        4: 3,
        5: 2,
        6: 3,
        7: 2,
        8: 3
    }
    for building_id, manager_id in building_managers.items():
        cursor.execute('UPDATE Building SET ManagerID = ? WHERE BuildingID = ?', (manager_id, building_id))
    
    rooms = []
    room_types = ['Lecture Hall', 'Laboratory', 'Office', 'Storage', 'Workshop', 'Computer Lab']
    for building_id in range(1, 9):
        for floor in range(1, 6):
            for room_num in range(1, 11):
                room_type = random.choice(room_types)
                if room_type in ['Lecture Hall', 'Laboratory']:
                    capacity = random.randint(20, 200)
                elif room_type == 'Office':
                    capacity = random.randint(1, 10)
                elif room_type == 'Computer Lab':
                    capacity = random.randint(30, 60)
                else:
                    capacity = random.randint(10, 50)
                office_manager = random.choice([1, 2, 3]) if room_type == 'Office' else random.choice([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
                rooms.append((building_id, f'{floor}{room_num:02d}', floor, capacity, office_manager))
    
    cursor.executemany('INSERT INTO Room (BuildingID, RoomNumber, Floor, Capacity, OfficeManagerID) VALUES (?, ?, ?, ?, ?)', rooms)
    
    equipment_types = [
        ('HVAC System', 'HVAC', 'Available'),
        ('Elevator', 'Transport', 'Available'),
        ('Fire Alarm System', 'Safety', 'Available'),
        ('Security Camera', 'Security', 'Available'),
        ('Projector', 'AV Equipment', 'In Use'),
        ('Air Conditioner', 'HVAC', 'Available'),
        ('Water Heater', 'Plumbing', 'Available'),
        ('Generator', 'Power', 'Available'),
        ('Cleaning Machine', 'Maintenance', 'In Use'),
        ('Lawn Mower', 'Maintenance', 'Available')
    ]
    
    equipment = []
    for i in range(50):
        eq_type = random.choice(equipment_types)
        purchase_date = (datetime.now() - timedelta(days=random.randint(30, 2000))).strftime('%Y-%m-%d')
        last_maintenance = (datetime.now() - timedelta(days=random.randint(0, 180))).strftime('%Y-%m-%d') if random.random() > 0.3 else None
        equipment.append((i+1, f'{eq_type[0]} #{i+1:02d}', eq_type[1], eq_type[2], purchase_date, last_maintenance))
    
    cursor.executemany('INSERT INTO Equipment (EquipmentID, Name, Type, Status, PurchaseDate, LastMaintenanceDate) VALUES (?, ?, ?, ?, ?, ?)', equipment)
    
    activities = [
        ('Weekly Building Inspection', 'Maintenance', '2024-11-18', '2024-11-18', 1),
        ('Monthly HVAC Maintenance', 'Maintenance', '2024-11-20', '2024-11-20', 2),
        ('Quarterly Fire Safety Check', 'Emergency', '2024-11-15', '2024-11-15', 3),
        ('Campus Cleaning Day', 'Daily Cleaning', '2024-11-22', '2024-11-22', 1),
        ('Equipment Calibration', 'Maintenance', '2024-11-25', '2024-11-25', 2),
        ('Emergency Drill', 'Emergency', '2024-11-10', '2024-11-10', 3),
        ('Garden Maintenance', 'Maintenance', '2024-11-19', '2024-11-19', 1),
        ('Window Cleaning', 'Window Repair', '2024-11-21', '2024-11-21', 2),
        ('Laboratory Equipment Service', 'Maintenance', '2024-11-23', '2024-11-23', 3),
        ('Security System Update', 'Maintenance', '2024-11-24', '2024-11-24', 1)
    ]
    
    cursor.executemany('INSERT INTO Activity (ActivityID, Description, Type, StartDate, EndDate, CompanyID) VALUES (?, ?, ?, ?, ?, ?)',
                      [(i+1, desc, act_type, start, end, company_id) for i, (desc, act_type, start, end, company_id) in enumerate(activities)])
    
    activity_locations = [
        (1, 1, '204', 'Room', None, 1, 'Available', 'Inspection can proceed while the room remains open.'),
        (2, 2, '503', 'Room', None, 0, 'Unavailable', 'HVAC servicing temporarily closes the room.'),
        (3, 2, '301', 'Room', None, 0, 'Unavailable', 'Fire safety checks require the room to be cleared.'),
        (4, 4, None, 'Floor', 'Second Floor Corridor', 0, 'Partially Restricted', 'Cleaning team blocks the corridor in sections during the shift.'),
        (5, 3, '405', 'Room', None, 0, 'Unavailable', 'Calibration work requires the lab to be vacated.'),
        (6, 7, None, 'Building', 'Assembly Forecourt', 0, 'Partially Restricted', 'Emergency drill staging area restricts access during the exercise.'),
        (7, 6, None, 'Outdoor Area', 'Main Sports Lawn', 1, 'Available', 'Grounds work happens outside the main circulation path.'),
        (8, 1, None, 'Common Area', 'North Facade Windows', 0, 'Partially Restricted', 'Window cleaning blocks nearby walkways with safety barriers.'),
        (9, 3, '302', 'Room', None, 0, 'Unavailable', 'Equipment servicing makes the lab temporarily unusable.'),
        (10, 7, '105', 'Room', None, 0, 'Unavailable', 'Security updates require the control room to be sealed during maintenance.')
    ]

    cursor.executemany(
        '''
        INSERT INTO Occurs_In (
            ActivityID, BuildingID, RoomNumber, AreaType, AreaLabel,
            IsUsableDuringActivity, ImpactLevel, ImpactNotes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        activity_locations
    )
    
    requests = [
        ('Broken Air Conditioner in Room 301', 'AC unit not cooling properly, needs immediate repair. Temperature rising in classroom.', 'High', 'Pending', 1, 1),
        ('Leaky Faucet in Restroom', 'Water leaking from faucet in 2nd floor restroom. Causing water damage to floor.', 'Medium', 'In Progress', 2, 2),
        ('Elevator Maintenance Request', 'Elevator making unusual noise between floors 3-5. Safety concern reported.', 'High', 'Pending', 3, 3),
        ('Light Bulb Replacement', 'Multiple bulbs burned out in main hallway. Poor visibility affecting safety.', 'Low', 'Completed', 4, 4),
        ('Door Lock Repair', 'Main entrance door lock not working. Security issue requiring urgent attention.', 'High', 'Pending', 5, 5),
        ('HVAC Filter Replacement', 'Air quality concerns. Filters need replacement in Building 2.', 'Medium', 'Assigned', 6, 1),
        ('Window Seal Repair', 'Windows in Room 405 leaking during rain. Water damage to interior.', 'Medium', 'In Progress', 7, 2),
        ('Generator Service', 'Backup generator requires annual service and testing.', 'Medium', 'Pending', 8, 3)
    ]
    
    request_dates = [(datetime.now() - timedelta(days=random.randint(1, 30))).strftime('%Y-%m-%d') for _ in range(8)]
    cursor.executemany('INSERT INTO MaintenanceRequest (RequestID, Title, Description, Priority, Status, RequestedByStaffID, ActivityID, RequestDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                      [(i+1, title, desc, priority, status, staff_id, activity_id, req_date) 
                       for i, ((title, desc, priority, status, staff_id, activity_id), req_date) in enumerate(zip(requests, request_dates))])
    
    maintenance_logs = [
        ('Routine HVAC filter replacement', '2024-11-15', '2025-02-15', 1, 4),
        ('Elevator safety inspection', '2024-11-10', '2025-05-10', 2, 5),
        ('Fire alarm system test', '2024-11-12', '2025-02-12', 3, 6),
        ('Generator oil change', '2024-11-08', '2025-02-08', 8, 7),
        ('AC unit repair and service', '2024-11-20', '2025-05-20', 5, 4),
        ('Projector bulb replacement', '2024-11-18', '2025-05-18', 5, 8),
        ('Security camera cleaning', '2024-11-14', '2025-02-14', 4, 9),
        ('Water heater descaling', '2024-11-16', '2025-05-16', 7, 10),
        ('Cleaning machine service', '2024-11-19', '2025-02-19', 9, 11),
        ('Lawn mower blade sharpening', '2024-11-17', '2025-03-17', 10, 12)
    ]
    
    cursor.executemany('INSERT INTO Maintenance_Log (LogID, Description, MaintenanceDate, NextMaintenanceDate, EquipmentID, StaffID) VALUES (?, ?, ?, ?, ?, ?)',
                      [(i+1, desc, maint_date, next_date, eq_id, staff_id) 
                       for i, (desc, maint_date, next_date, eq_id, staff_id) in enumerate(maintenance_logs)])
    
    for i in range(6, 11):
        cursor.execute('INSERT INTO Request_Assignment (RequestID, StaffID, AssignedDate) VALUES (?, ?, ?)',
                      (i-5, random.randint(4, 15), (datetime.now() - timedelta(days=random.randint(1, 10))).strftime('%Y-%m-%d')))
    
    chemicals = [
        ('Disinfectant Cleaner', 'Hazardous if ingested, use in well-ventilated area'),
        ('Floor Polish', 'Flammable, keep away from heat sources'),
        ('Glass Cleaner', 'Eye irritant, avoid contact with eyes'),
        ('Drain Cleaner', 'Corrosive, wear protective gloves'),
        ('Paint Thinner', 'Highly flammable, store in cool place'),
        ('Bleach Solution', 'Toxic fumes, use with proper ventilation'),
        ('Metal Polish', 'Contains solvents, avoid skin contact'),
        ('Carpet Cleaner', 'May cause respiratory irritation')
    ]
    
    cursor.executemany('INSERT INTO Chemical (ChemicalID, Name, HazardInfo) VALUES (?, ?, ?)',
                      [(i+1, name, hazard) for i, (name, hazard) in enumerate(chemicals)])
    
    suppliers = [
        ('ABC Supply Co.', 'John Smith', '852-2345-6789', 'john@abcsupply.com'),
        ('Tech Equipment Ltd.', 'Mary Chen', '852-3456-7890', 'mary@techequip.com'),
        ('Maintenance Pro', 'David Lee', '852-4567-8901', 'david@mainpro.com')
    ]
    
    cursor.executemany('INSERT INTO Supplier (SupplierID, SupplierName, ContactPerson, Phone, Email) VALUES (?, ?, ?, ?, ?)',
                      [(i+1, name, contact, phone, email) for i, (name, contact, phone, email) in enumerate(suppliers)])
    
    companies = [
        ('CleanTech Services', '852-5678-9012, info@cleantech.com'),
        ('Safety First Corp', '852-6789-0123, contact@safetyfirst.com'),
        ('Maintenance Experts', '852-7890-1234, support@maintexperts.com')
    ]
    
    cursor.executemany('INSERT INTO ExternalCompany (CompanyID, CompanyName, ContactInfo) VALUES (?, ?, ?)',
                      [(i+1, name, contact) for i, (name, contact) in enumerate(companies)])
    
    for i in range(1, 51):
        supplier_id = random.randint(1, 3) if random.random() > 0.2 else None
        cursor.execute('UPDATE Equipment SET SupplierID = ? WHERE EquipmentID = ?', (supplier_id, i))
    
    cursor.execute('INSERT INTO Used (ActivityID, ChemicalID, Quantity) VALUES (4, 1, 5)')
    cursor.execute('INSERT INTO Used (ActivityID, ChemicalID, Quantity) VALUES (4, 2, 3)')
    cursor.execute('INSERT INTO Used (ActivityID, ChemicalID, Quantity) VALUES (8, 3, 2)')
    cursor.execute('INSERT INTO Used (ActivityID, ChemicalID, Quantity) VALUES (1, 4, 1)')
    cursor.execute('INSERT INTO Used (ActivityID, ChemicalID, Quantity) VALUES (3, 5, 2)')
    
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (4, 1, "Inspector", 4)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (5, 2, "Technician", 6)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (6, 3, "Safety Officer", 3)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (7, 4, "Cleaner", 8)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (8, 5, "Technician", 4)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (9, 6, "Coordinator", 2)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (10, 7, "Maintenance Worker", 6)')
    cursor.execute('INSERT INTO Performs (StaffID, ActivityID, Role, HoursWorked) VALUES (11, 8, "Window Cleaner", 4)')
    
    cursor.execute('INSERT INTO Uses_Equipment (ActivityID, EquipmentID, UsageHours) VALUES (2, 1, 4)')
    cursor.execute('INSERT INTO Uses_Equipment (ActivityID, EquipmentID, UsageHours) VALUES (5, 5, 2)')
    cursor.execute('INSERT INTO Uses_Equipment (ActivityID, EquipmentID, UsageHours) VALUES (1, 3, 2)')
    cursor.execute('INSERT INTO Uses_Equipment (ActivityID, EquipmentID, UsageHours) VALUES (3, 2, 1)')
    cursor.execute('INSERT INTO Uses_Equipment (ActivityID, EquipmentID, UsageHours) VALUES (7, 9, 6)')
    cursor.execute('INSERT INTO Uses_Equipment (ActivityID, EquipmentID, UsageHours) VALUES (9, 10, 3)')
    
    conn.commit()
    conn.close()
    print(f'Realistic data seeded successfully into {db_path}!')

if __name__ == '__main__':
    args = parse_args()
    seed_data(os.path.abspath(os.path.expanduser(args.db)))
