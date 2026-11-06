import React from 'react';
import { Users, UserCheck, Briefcase } from 'lucide-react';

interface EmployeeKpiCardsProps {
  employeesList: any[];
}

export default function EmployeeKpiCards({ employeesList }: EmployeeKpiCardsProps) {
  const totalEmployees = employeesList?.length > 0 ? employeesList.length : 18;
  const activeEmployees = employeesList?.length > 0
    ? employeesList.filter((e: any) => e.isActive).length
    : 16;
  const inactiveEmployees = totalEmployees - activeEmployees;

  // Department counts
  const departments = new Set(
    employeesList
      ?.map((e: any) => e.department)
      .filter(Boolean)
  );
  const totalDepartments = departments.size > 0 ? departments.size : 4;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      
      {/* 1. Total Workforce */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Agency Workforce</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-gray-900">{totalEmployees}</h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              {activeEmployees} Active
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Registered Team Members</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Users className="w-6 h-6" />
        </div>
      </div>

      {/* 2. Active Team Members */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Team Members</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-emerald-600">{activeEmployees}</h3>
            <span className="text-xs font-semibold text-gray-500">
              {inactiveEmployees > 0 ? `${inactiveEmployees} Inactive` : 'All Active'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Operational Staff
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <UserCheck className="w-6 h-6" />
        </div>
      </div>

      {/* 3. Departments & Teams */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Departments & Teams</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-indigo-700">{totalDepartments}</h3>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/80">
              Specialized Units
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Sales, Ops, Claims & Support</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Briefcase className="w-6 h-6" />
        </div>
      </div>

    </div>
  );
}
