import { useState } from "react";
import { Star, MessageSquare, Send, CheckCircle, Sparkles } from "lucide-react";
import clsx from "clsx";

interface Props {
  onSubmit: (data: { rating: number; comment?: string }) => Promise<void>;
  professionalName?: string;
  alreadyReviewed?: boolean;
  loading?: boolean;
}

const criteria = [
  { key: "quality", label: "Qualidade do serviço", emoji: "🛠️" },
  { key: "punctuality", label: "Pontualidade", emoji: "⏰" },
  { key: "communication", label: "Comunicação", emoji: "💬" },
];

export default function ReviewCTA({
  onSubmit,
  professionalName = "o profissional",
  alreadyReviewed,
  loading,
}: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({
    quality: 5,
    punctuality: 5,
    communication: 5,
  });
  const [hoverRatings, setHoverRatings] = useState<Record<string, number | null>>({
    quality: null,
    punctuality: null,
    communication: null,
  });
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (alreadyReviewed || submitted) {
    return (
      <div className="card p-5">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Avaliação enviada!
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Obrigado por avaliar. Sua opinião ajuda outros clientes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="card card-hover p-5 w-full text-left group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Como foi o serviço?
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Avalie {professionalName} e ajude outros clientes
            </p>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="w-5 h-5 text-amber-400 fill-amber-400 group-hover:animate-pulse"
                style={{ animationDelay: `${star * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </button>
    );
  }

  const averageRating =
    Math.round(
      ((ratings.quality + ratings.punctuality + ratings.communication) / 3) * 10
    ) / 10;

  const handleSubmit = async () => {
    await onSubmit({
      rating: averageRating,
      comment: comment.trim() || undefined,
    });
    setSubmitted(true);
  };

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Avaliar serviço
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-lg text-amber-500">
            {averageRating.toFixed(1)}
          </span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
      </div>

      {/* Rating criteria */}
      <div className="space-y-4">
        {criteria.map((criterion) => {
          const currentRating = ratings[criterion.key];
          const hoverRating = hoverRatings[criterion.key];

          return (
            <div key={criterion.key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>{criterion.emoji}</span>
                  {criterion.label}
                </label>
                <span className="text-xs font-mono text-slate-500">
                  {hoverRating ?? currentRating}/5
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const displayRating = hoverRating ?? currentRating;
                  const isFilled = star <= displayRating;

                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setRatings((prev) => ({ ...prev, [criterion.key]: star }))
                      }
                      onMouseEnter={() =>
                        setHoverRatings((prev) => ({ ...prev, [criterion.key]: star }))
                      }
                      onMouseLeave={() =>
                        setHoverRatings((prev) => ({ ...prev, [criterion.key]: null }))
                      }
                      className={clsx(
                        "p-1 rounded-md transition-all duration-150",
                        "hover:scale-125 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      )}
                    >
                      <Star
                        className={clsx(
                          "w-7 h-7 transition-colors",
                          isFilled
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-300 dark:text-slate-600"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment */}
      <div>
        <label className="label flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Comentário (opcional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Conte como foi sua experiência..."
          rows={3}
          maxLength={500}
          className="input resize-none"
        />
        <div className="flex justify-end mt-1">
          <span className="text-xs text-slate-400">{comment.length}/500</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn btn-primary w-full py-2.5 font-semibold"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Enviando...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            Enviar avaliação
          </span>
        )}
      </button>
    </div>
  );
}
