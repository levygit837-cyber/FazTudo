import React, { useState, useEffect } from "react";
import { Plus, MessageSquare } from "lucide-react";
import api from "../../services/api";
import { CompanyChannel } from "../../types";
import { useToast } from "../../context/ToastContext";
import ChannelCard from "../../components/company/ChannelCard";

const CompanyChannels: React.FC = () => {
  const [channels, setChannels] = useState<CompanyChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const loadChannels = async () => {
    try {
      setLoading(true);
      const res = await api.get("/company/channels");
      setChannels(res.data.data);
    } catch {
      toast.error("Erro ao carregar canais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChannels(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await api.post("/company/channels", { name: newName.trim(), description: newDesc.trim() });
      toast.success("Canal criado!");
      setShowModal(false);
      setNewName("");
      setNewDesc("");
      loadChannels();
    } catch {
      toast.error("Erro ao criar canal");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (channelId: number, isActive: boolean) => {
    try {
      await api.put(`/company/channels/${channelId}`, { isActive: !isActive });
      toast.success(isActive ? "Canal desativado" : "Canal ativado");
      loadChannels();
    } catch {
      toast.error("Erro ao atualizar canal");
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-32 animate-pulse bg-slate-100 dark:bg-slate-700" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Canais de Atendimento</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Organize sua equipe por tipo de serviço</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Canal
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Nenhum canal criado</h3>
          <p className="text-slate-500 mb-6">Crie canais para organizar sua equipe por tipo de serviço</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Criar primeiro canal
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map(channel => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onToggleActive={() => handleToggleActive(channel.id, channel.isActive)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">Novo Canal</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Nome do canal *</label>
                <input
                  className="input w-full"
                  placeholder="ex: Limpeza Residencial"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Descrição</label>
                <textarea
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="Descreva o tipo de serviço deste canal"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn btn-ghost flex-1" onClick={() => setShowModal(false)} disabled={creating}>
                Cancelar
              </button>
              <button className="btn btn-primary flex-1" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Criando..." : "Criar Canal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyChannels;
