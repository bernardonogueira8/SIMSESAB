import { useState, useEffect, useRef } from 'react';

export default function ConsultaForm() {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Efeito de Debounce e Chamada da API Interna
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          // Chamando nossa API Proxy do Astro
          const res = await fetch(`/api/medicamentos?term=${encodeURIComponent(query)}`);
          const data = await res.json();
          setResultados(data.results || []);
          setIsOpen(true);
        } catch (error) {
          console.error("Erro ao buscar medicamentos", error);
        } finally {
          setLoading(false);
        }
      } else {
        setResultados([]);
        setIsOpen(false);
      }
    }, 400); // 400ms de debounce para evitar spam na API

    return () => clearTimeout(timer);
  }, [query]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (medicamento: string) => {
    setQuery(medicamento);
    setIsOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-3xl p-6 md:p-8">
      <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Consulta de Medicamentos</h2>
      <p className="text-slate-900 text text-center"> Consulte aqui se o seu medicamento é disponibilizado pelo SUS na Bahia.</p>
      <p className="text-slate-500 mb-8 text-sm text-center">Preencha um dos campos abaixo com base em sua receita médica ou laudo.</p>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Campo 1: Medicamento com Autocomplete */}
        <div className="relative" ref={dropdownRef}>
          <label htmlFor="input-medicamento" className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
            💊 Campo 1 — Medicamento
          </label>
          <input
            type="text"
            id="input-medicamento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
            placeholder="Digite o princípio ativo ou nome comercial..."
            autoComplete="off"
          />
          <p className="text-xs text-slate-500 mt-2">Dica: prefira o princípio ativo (genérico) que aparece logo abaixo do nome comercial na receita.</p>

          {/* Renderização Condicional do Dropdown */}
          {isOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-4 text-sm text-slate-500 text-center">Buscando medicamentos...</div>
              ) : resultados.length > 0 ? (
                <ul className="py-1">
                  {resultados.map((med, index) => {
                    // Separando o nome comercial do princípio ativo caso a API retorne com " | "
                    const [nome, info] = med.split(' | ');
                    return (
                      <li 
                        key={index}
                        onClick={() => handleSelect(nome)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <div className="font-medium text-slate-800">{nome}</div>
                        {info && <div className="text-xs text-slate-500">{info}</div>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 py-4 text-sm text-slate-500 text-center">
                  Nenhum resultado encontrado para "<span className="font-semibold text-slate-700">{query}</span>".
                </div>
              )}
            </div>
          )}
        </div>

        {/* Campo 2: CID-10 */}
        <div>
          <label htmlFor="input-cid" className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
            🩺 Campo 2 — CID-10 (diagnóstico)
          </label>
          <input
            type="text"
            id="input-cid"
            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 transition-colors"
            placeholder="Digite o código ou parte da descrição (ex: I10, Diabetes)"
          />
        </div>

        {/* Botões */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button type="submit" className="bg-[#1e4b8f] hover:bg-blue-900 text-white font-medium py-3 px-6 rounded-lg transition-colors">
            Verificar disponibilidade
          </button>
          <button 
            type="button" 
            onClick={() => setQuery('')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            ↺ Limpar
          </button>
        </div>
      </form>
    </div>
  );
}