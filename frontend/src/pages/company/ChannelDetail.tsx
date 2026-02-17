import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import api from "../../services/api";
import { CompanyChannel, CompanyMember } from "../../types";
import { useToast } from "../../context/ToastContext";

const ChannelDetail: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [channel, setChannel] = useState<CompanyChannel | null>(null);
  const [allMembers, setAllMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | "">("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [channelsRes, membersRes] = await Promise.all([
        api.get("/company/channels"),
        api.get("/company/members"),
      ]);
      const found = channelsRes.data.data.find((c: CompanyChannel) => c.id === Number(channelId));
      setChannel(found || null);
      setAllMembers(membersRes.data.data);
    } catch {
      toast.error("Erro ao carregar canal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [channelId]);

  const handleAddMember = async () => {
    if (!selectedMemberId) return;
    try {
      setAdding(true);
      await api.post(`/company/channels/${channelId}/members`, { memberId: selectedMemberId });
      toast.success("Membro adicionado ao canal");
      setSelectedMemberId("");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao adicionar membro");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await api.delete(`/company/channels/${channelId}/members/${memberId}`);
      toast.success("Membro removido do canal");
      loadData();
    } catch {
      toast.error("Erro ao remover membro");
    }
  };

  const channelMemberIds = channel?.members?.map(m => m.memberId) ?? [];
  const availableMembers = allMembers.filter(m => !channelMemberIds.includes(m.id) && m.isActive);

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="card h-64 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />
    </div>
  );

  if (!channel) return (
    <div className="container mx-auto px-4 py-8 text-center text-slate-500">
      Canal não encontrado
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <button onClick={() => navigate("/company/channels")} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Canais
      </button>

      <div className="card p-6 mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{channel.name}</h1>
        {channel.description && <p className="text-slate-500 mt-1">{channel.description}</p>}
        <span className={`inline-flex items-center mt-3 px-2 py-0.5 rounded-full text-xs font-medium ${channel.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {channel.isActive ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
          Membros do Canal ({channel.members?.length ?? 0})
        </h2>

        {availableMembers.length > 0 && (
          <div className="flex gap-2 mb-4">
            <select
              className="input flex-1"
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(Number(e.target.value) || "")}
            >
              <option value="">Selecionar membro...</option>
              {availableMembers.map(m => (
                <option key={m.id} value={m.id}>{m.user.name} — {m.role.name}</option>
              ))}
            </select>
            <button onClick={handleAddMember} disabled={!selectedMemberId || adding} className="btn btn-primary">
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-3">
          {(channel.members ?? []).map(cm => (
            <div key={cm.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                  {cm.member.user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{cm.member.user.name}</p>
                  <p className="text-xs text-slate-500">{cm.member.role.name}</p>
                </div>
              </div>
              <button onClick={() => handleRemoveMember(cm.memberId)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {(channel.members ?? []).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum membro neste canal ainda</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelDetail;
