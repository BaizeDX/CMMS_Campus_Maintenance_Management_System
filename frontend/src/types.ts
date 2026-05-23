export interface Staff {
  StaffID: string;
  Name: string;
  Role: string;
  Status: 'Active' | 'On Leave';
  OfficeLocation: string;
}

export interface Chemical {
  ChemicalID: string;
  Name: string;
  HazardInfo: string | null; // Null if safe, string if hazardous
}

export interface Activity {
  ActivityID: string;
  Description: string;
  Type: 'Maintenance' | 'Lab Work' | 'Lecture' | 'Inspection';
  StartDate: string; // ISO String
  EndDate: string;   // ISO String
  BuildingID: string;
  RoomNumber: string;
  UsedChemicals: Chemical[]; // Joined for UI display logic
}

export interface MaintenanceRequest {
  RequestID: string;
  Title: string;
  Description: string;
  Priority: 'High' | 'Medium' | 'Low';
  Status: 'Pending' | 'In Progress' | 'Completed';
  RequestedByStaffID: string;
  DateSubmitted: string;
}

export interface Equipment {
  EquipmentID: string;
  Name: string;
  Status: 'Active' | 'Under Repair' | 'Decommissioned';
  NextMaintenanceDate: string; // ISO String
  Location: string;
}

export interface MaintenanceLog {
  LogID: string;
  Description: string;
  Date: string;
}