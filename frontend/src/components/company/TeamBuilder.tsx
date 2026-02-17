import React, { useState } from "react";
import { X, Users } from "lucide-react";
import { CompanyMember } from "../../types";
import api from "../../services/api";

interface Props {
  orderId: number;
  members: CompanyMember[];
  onTeamCreated: () => void;
  onClose: () => void;
}

const TeamBuilder: React.FC<Props> = ({ orderId, members, onTeamCreated, onClose }) => {
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMember = (memberId: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
    if (leaderId === memberId) setLeaderId(null);
  };

  const handleSubmit = async () => {
    if (!leaderId) { setError("Selecione um líder para a equipe"); return; }
    if (selectedMemberIds.length === 0) { setError("Selecione pelo menos um membro"); return; }
    setLoading(true);
    try {
      await api.post("/company/teams", { orderId, leaderId, memberIds: selectedMemberIds });
      onTeamCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao criar equipe");
    } finally {
      setLoading(false);
    }
  };

  const activeMembers = members.filter(m => m.isActive);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Users className="h-5 w-5 text-blue-600" />
            Designar Equipe
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {activeMembers.length === 0 ? (
            <p className="text-center text-slate-500">Nenhum membro ativo encontrado.</p>
          ) : (
            activeMembers.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id={`member-${member.id}`}
                  checked={selectedMemberIds.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor={`member-${member.id}`} className="flex-1 cursor-pointer">
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{member.user.name}</p>
                  <p className="text-xs text-slate-500">{member.role?.name}</p>
                </label>
                {selectedMemberIds.includes(member.id) && (
                  <label className="flex items-center gap-1 text-xs text-blue-600">
                    <input
                      type="radio"
                      name="leader"
                      checked={leaderId === member.id}
                      onChange={() => setLeaderId(member.id)}
                      className="h-3 w-3"
                    />
                    Líder
                  </label>
                )}
              </div>
            ))
          )}
        </div>
        {error && <p className="px-6 text-sm text-red-600">{error}</p>}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button onClick={onClose} className="btn flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">
            {loading ? "Criando..." : "Criar Equipe"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamBuilder;
