import React from "react";
import { User, Trash2 } from "lucide-react";
import { CompanyMember } from "../../types";

interface Props {
  member: CompanyMember;
  onRemove: (memberId: number) => void;
}

const MemberCard: React.FC<Props> = ({ member, onRemove }) => (
  <div className="card p-4 flex items-center gap-4">
    {member.user.profileImage ? (
      <img src={member.user.profileImage} alt={member.user.name} className="w-10 h-10 rounded-full object-cover" />
    ) : (
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        <User className="h-5 w-5 text-slate-500" />
      </div>
    )}
    <div className="flex-1">
      <p className="font-medium text-slate-900 dark:text-slate-100">{member.user.name}</p>
      <p className="text-sm text-slate-500">{member.user.email}</p>
      {member.role && (
        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
          {member.role.name}
        </span>
      )}
    </div>
    <span className={`text-xs px-2 py-0.5 rounded-full ${member.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {member.isActive ? "Ativo" : "Inativo"}
    </span>
    <button
      onClick={() => onRemove(member.id)}
      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      title="Remover membro"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
);

export default MemberCard;
