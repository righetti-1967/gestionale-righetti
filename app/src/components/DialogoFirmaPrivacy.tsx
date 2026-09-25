interface DialogoFirmaPrivacyProps {
  nomeCliente: string;
  onFirmaOra: () => void;
  onPiuTardi: () => void;
}

export function DialogoFirmaPrivacy({
  nomeCliente,
  onFirmaOra,
  onPiuTardi,
}: DialogoFirmaPrivacyProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
      onClick={onPiuTardi}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icona */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
            ✓
          </div>
        </div>

        {/* Titolo */}
        <h2 className="text-lg font-bold text-apple-darkgray text-center mb-2">
          Cliente creato con successo!
        </h2>
        <p className="text-sm text-apple-gray text-center mb-6">
          <strong className="text-apple-darkgray">{nomeCliente}</strong> è stato salvato
          nell'archivio. Vuoi far firmare ora il consenso privacy?
        </p>

        {/* Azioni */}
        <div className="space-y-2">
          <button
            onClick={onFirmaOra}
            className="w-full px-4 py-3 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>✍️</span>
            <span>Firma ora</span>
          </button>
          <button
            onClick={onPiuTardi}
            className="w-full px-4 py-3 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <span>🕐</span>
            <span>Più tardi</span>
          </button>
        </div>

        <p className="text-xs text-apple-gray text-center mt-4">
          Potrai sempre far firmare il cliente dalla sua scheda
        </p>
      </div>
    </div>
  );
}
