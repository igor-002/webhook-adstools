// Maps Atendai queue name (nome_fila) -> ADS-Tools lead status + tags.
// Queues not listed here are ignored (logged, no API call).
const filaMap = {
  'Novo Lead': { status: 'open', tags: ['novo-lead'] },
  'Em atendimento': { status: 'in_progress', tags: ['em-atendimento'] },
  'Orçamento': { status: 'in_progress', tags: ['orcamento'] },
  'Em Negociação': { status: 'in_progress', tags: ['em-negociacao'] },
  'Convertido': { status: 'closed_won', tags: ['convertido'] },
};

module.exports = { filaMap };
