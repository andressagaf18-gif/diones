// api/lib/question-engine.js
// Finder — catálogo e regras de perguntas por estrutura.
// O objetivo é impedir que PF, Holding, SPE e Grupo caiam
// no checklist de empresa operacional.

export const EIXOS_PERGUNTAS = {
  pessoa_fisica: {
    organizacao_financeira: {
      label: "Organização financeira",
      perguntas: [
        {
          id: "pf_org_01",
          tema: "Controle financeiro",
          pergunta: "Você acompanha mensalmente quanto recebe, quanto gasta e quanto efetivamente consegue poupar?",
          riscoAvaliado: "Baixa visibilidade sobre a própria situação financeira.",
          importancia: 3,
        },
        {
          id: "pf_org_02",
          tema: "Orçamento",
          pergunta: "Você possui um orçamento mensal com limites ou metas para os principais grupos de gastos?",
          riscoAvaliado: "Gastos sem referência objetiva de controle.",
          importancia: 2,
        },
        {
          id: "pf_org_03",
          tema: "Previsibilidade",
          pergunta: "Você consegue prever seus principais compromissos financeiros dos próximos 90 dias?",
          riscoAvaliado: "Decisões financeiras reativas e baixa previsibilidade.",
          importancia: 2,
        },
      ],
    },

    fluxo_pessoal: {
      label: "Fluxo financeiro pessoal",
      perguntas: [
        {
          id: "pf_flux_01",
          tema: "Sobra mensal",
          pergunta: "Na maior parte dos meses, sua renda é suficiente para pagar todos os gastos e ainda gerar sobra?",
          riscoAvaliado: "Baixa capacidade de formação de reserva e patrimônio.",
          importancia: 3,
        },
        {
          id: "pf_flux_02",
          tema: "Renda variável",
          pergunta: "Se sua renda variar ou cair por alguns meses, você consegue manter seus compromissos sem recorrer a crédito?",
          riscoAvaliado: "Dependência excessiva da renda corrente.",
          importancia: 3,
        },
      ],
    },

    endividamento: {
      label: "Endividamento",
      perguntas: [
        {
          id: "pf_div_01",
          tema: "Mapa de dívidas",
          pergunta: "Você conhece o saldo, a taxa de juros, a parcela e o prazo de todas as suas dívidas?",
          riscoAvaliado: "Dívidas sem priorização baseada em custo e impacto.",
          importancia: 3,
        },
        {
          id: "pf_div_02",
          tema: "Comprometimento da renda",
          pergunta: "As parcelas de dívidas comprometem uma parte relevante da sua renda mensal?",
          riscoAvaliado: "Baixa flexibilidade financeira.",
          importancia: 3,
        },
        {
          id: "pf_div_03",
          tema: "Crédito rotativo",
          pergunta: "Você utiliza rotativo do cartão, cheque especial ou crédito de curto prazo para fechar o mês?",
          riscoAvaliado: "Uso recorrente de crédito caro.",
          importancia: 3,
        },
      ],
    },

    reserva_seguranca: {
      label: "Reserva e segurança",
      perguntas: [
        {
          id: "pf_res_01",
          tema: "Reserva de emergência",
          pergunta: "Você possui uma reserva financeira separada exclusivamente para imprevistos?",
          riscoAvaliado: "Ausência de proteção contra eventos inesperados.",
          importancia: 3,
        },
        {
          id: "pf_res_02",
          tema: "Cobertura",
          pergunta: "Essa reserva seria suficiente para cobrir vários meses dos seus gastos essenciais?",
          riscoAvaliado: "Reserva insuficiente para o padrão de despesas.",
          importancia: 3,
        },
      ],
    },

    patrimonio: {
      label: "Patrimônio",
      perguntas: [
        {
          id: "pf_pat_01",
          tema: "Visão patrimonial",
          pergunta: "Você possui uma relação atualizada dos seus bens, investimentos, participações e dívidas?",
          riscoAvaliado: "Patrimônio fragmentado e sem visão consolidada.",
          importancia: 2,
        },
        {
          id: "pf_pat_02",
          tema: "Concentração",
          pergunta: "Você sabe quanto do seu patrimônio está concentrado em imóveis, empresas e investimentos financeiros?",
          riscoAvaliado: "Concentração patrimonial não monitorada.",
          importancia: 2,
        },
      ],
    },

    investimentos: {
      label: "Investimentos",
      perguntas: [
        {
          id: "pf_inv_01",
          tema: "Objetivos",
          pergunta: "Seus investimentos estão organizados de acordo com objetivos e prazos definidos?",
          riscoAvaliado: "Carteira sem relação clara com objetivos financeiros.",
          importancia: 3,
        },
        {
          id: "pf_inv_02",
          tema: "Liquidez",
          pergunta: "Você separa reserva de emergência, objetivos de curto prazo e investimentos de longo prazo?",
          riscoAvaliado: "Liquidez inadequada para necessidades futuras.",
          importancia: 3,
        },
        {
          id: "pf_inv_03",
          tema: "Conhecimento de risco",
          pergunta: "Você entende o risco, a liquidez e a finalidade dos principais investimentos que possui?",
          riscoAvaliado: "Produtos ou estratégias possivelmente incompatíveis com o objetivo.",
          importancia: 2,
        },
      ],
    },

    aposentadoria: {
      label: "Aposentadoria",
      perguntas: [
        {
          id: "pf_apo_01",
          tema: "Idade-alvo",
          pergunta: "Você já definiu em que idade gostaria de reduzir ou encerrar sua atividade profissional?",
          riscoAvaliado: "Aposentadoria sem horizonte temporal definido.",
          importancia: 2,
        },
        {
          id: "pf_apo_02",
          tema: "Renda desejada",
          pergunta: "Você sabe qual renda mensal gostaria de ter na aposentadoria, em valores atuais?",
          riscoAvaliado: "Meta de aposentadoria sem referência de renda.",
          importancia: 3,
        },
        {
          id: "pf_apo_03",
          tema: "Patrimônio-alvo",
          pergunta: "Você sabe aproximadamente quanto patrimônio precisa acumular para sustentar essa renda?",
          riscoAvaliado: "Meta de aposentadoria sem patrimônio-alvo.",
          importancia: 3,
        },
        {
          id: "pf_apo_04",
          tema: "Aporte",
          pergunta: "Você conhece quanto precisaria investir mensalmente para atingir seu objetivo de aposentadoria?",
          riscoAvaliado: "Distância entre objetivo futuro e aporte atual desconhecida.",
          importancia: 3,
        },
      ],
    },

    protecao_familiar: {
      label: "Proteção familiar",
      perguntas: [
        {
          id: "pf_prot_01",
          tema: "Dependentes",
          pergunta: "Existem pessoas que dependem financeiramente da sua renda?",
          riscoAvaliado: "Dependentes expostos a interrupção de renda.",
          importancia: 3,
        },
        {
          id: "pf_prot_02",
          tema: "Proteção",
          pergunta: "Você já avaliou como sua família manteria os principais compromissos caso sua renda fosse interrompida?",
          riscoAvaliado: "Proteção familiar insuficiente.",
          importancia: 3,
        },
      ],
    },

    tributario_pf: {
      label: "Tributário PF",
      perguntas: [
        {
          id: "pf_tri_01",
          tema: "IRPF",
          pergunta: "Sua declaração de imposto de renda reflete corretamente suas fontes de renda, bens, investimentos e dívidas?",
          riscoAvaliado: "Risco de inconsistências fiscais ou patrimoniais.",
          importancia: 3,
        },
        {
          id: "pf_tri_02",
          tema: "Rendas adicionais",
          pergunta: "Você recebe aluguéis, rendimentos do exterior, atividade autônoma ou outras receitas além do salário/pró-labore?",
          riscoAvaliado: "Receitas com tratamento tributário específico não mapeadas.",
          importancia: 2,
        },
      ],
    },

    sucessao: {
      label: "Sucessão",
      perguntas: [
        {
          id: "pf_suc_01",
          tema: "Organização sucessória",
          pergunta: "Você já avaliou como seus bens e participações seriam transmitidos aos herdeiros?",
          riscoAvaliado: "Sucessão patrimonial sem planejamento.",
          importancia: 2,
        },
        {
          id: "pf_suc_02",
          tema: "Complexidade patrimonial",
          pergunta: "Seu patrimônio inclui imóveis, empresas ou ativos cuja divisão entre herdeiros pode ser complexa?",
          riscoAvaliado: "Possibilidade de conflito ou perda de eficiência na sucessão.",
          importancia: 2,
        },
      ],
    },

    objetivos: {
      label: "Objetivos",
      perguntas: [
        {
          id: "pf_obj_01",
          tema: "Prioridade",
          pergunta: "Você possui um objetivo financeiro principal claramente definido para os próximos 3 anos?",
          riscoAvaliado: "Recursos dispersos entre prioridades concorrentes.",
          importancia: 3,
        },
        {
          id: "pf_obj_02",
          tema: "Plano",
          pergunta: "Esse objetivo possui valor, prazo e uma estratégia de acompanhamento?",
          riscoAvaliado: "Objetivo sem plano mensurável de execução.",
          importancia: 3,
        },
      ],
    },
  },

  avaliar_holding: {
    objetivos: {
      label: "Objetivos da estrutura",
      perguntas: [
        {
          id: "ah_obj_01",
          tema: "Finalidade",
          pergunta: "O principal objetivo é organização patrimonial, sucessão, governança, tributação ou centralização de participações?",
          riscoAvaliado: "Estrutura criada sem objetivo claramente definido.",
          importancia: 3,
        },
        {
          id: "ah_obj_02",
          tema: "Resultado esperado",
          pergunta: "Você consegue explicar qual problema espera resolver com uma holding?",
          riscoAvaliado: "Risco de criar estrutura sem benefício mensurável.",
          importancia: 3,
        },
      ],
    },

    patrimonio: {
      label: "Patrimônio",
      perguntas: [
        {
          id: "ah_pat_01",
          tema: "Composição patrimonial",
          pergunta: "Você possui uma relação dos principais bens que poderiam fazer parte da estrutura?",
          riscoAvaliado: "Patrimônio não mapeado antes da análise.",
          importancia: 3,
        },
        {
          id: "ah_pat_02",
          tema: "Titularidade",
          pergunta: "Está claro quais bens estão na pessoa física, em empresas e em copropriedade?",
          riscoAvaliado: "Titularidade fragmentada e custo de reorganização não conhecido.",
          importancia: 3,
        },
      ],
    },

    imoveis: {
      label: "Imóveis",
      perguntas: [
        {
          id: "ah_im_01",
          tema: "Imóveis",
          pergunta: "Há imóveis próprios, financiados, alugados ou utilizados por empresas da família?",
          riscoAvaliado: "Tratamentos jurídicos e tributários distintos não mapeados.",
          importancia: 3,
        },
        {
          id: "ah_im_02",
          tema: "Movimentação futura",
          pergunta: "Existe intenção de comprar, vender, doar ou integralizar imóveis nos próximos anos?",
          riscoAvaliado: "Reorganização sem considerar eventos futuros relevantes.",
          importancia: 3,
        },
      ],
    },

    participacoes: {
      label: "Participações societárias",
      perguntas: [
        {
          id: "ah_part_01",
          tema: "Empresas",
          pergunta: "Você ou sua família possuem participações em empresas operacionais ou investimentos societários?",
          riscoAvaliado: "Participações fora do planejamento patrimonial.",
          importancia: 3,
        },
        {
          id: "ah_part_02",
          tema: "Controle",
          pergunta: "Existem regras claras de controle, voto, administração e distribuição de resultados nessas empresas?",
          riscoAvaliado: "Governança societária insuficiente.",
          importancia: 2,
        },
      ],
    },

    receitas: {
      label: "Receitas patrimoniais",
      perguntas: [
        {
          id: "ah_rec_01",
          tema: "Renda patrimonial",
          pergunta: "Há receitas relevantes de aluguel, dividendos, juros, venda de bens ou outras fontes patrimoniais?",
          riscoAvaliado: "Estrutura proposta sem análise das fontes reais de receita.",
          importancia: 3,
        },
      ],
    },

    familia_sucessao: {
      label: "Família e sucessão",
      perguntas: [
        {
          id: "ah_suc_01",
          tema: "Herdeiros",
          pergunta: "Há herdeiros e já existe alguma definição sobre administração e transmissão do patrimônio?",
          riscoAvaliado: "Sucessão sem regras claras.",
          importancia: 3,
        },
        {
          id: "ah_suc_02",
          tema: "Conflitos",
          pergunta: "Existem diferenças relevantes de participação, interesse ou capacidade de gestão entre os herdeiros?",
          riscoAvaliado: "Potencial conflito sucessório.",
          importancia: 3,
        },
      ],
    },

    tributario: {
      label: "Tributário patrimonial",
      perguntas: [
        {
          id: "ah_tri_01",
          tema: "Carga atual",
          pergunta: "Você conhece a tributação atual sobre aluguéis, ganhos de capital, dividendos e demais rendas patrimoniais?",
          riscoAvaliado: "Comparação PF x holding sem base tributária atual.",
          importancia: 3,
        },
        {
          id: "ah_tri_02",
          tema: "Comparação",
          pergunta: "Já foi feita uma simulação completa dos custos de constituição, manutenção e tributação da holding?",
          riscoAvaliado: "Decisão baseada apenas em percepção de economia tributária.",
          importancia: 3,
        },
      ],
    },

    financiamentos: {
      label: "Financiamentos e obrigações",
      perguntas: [
        {
          id: "ah_fin_01",
          tema: "Financiamentos",
          pergunta: "Existem imóveis ou ativos financiados, dados em garantia ou vinculados a contratos que possam dificultar a transferência?",
          riscoAvaliado: "Restrição contratual ou financeira à reorganização.",
          importancia: 3,
        },
      ],
    },

    custos_viabilidade: {
      label: "Custos e viabilidade",
      perguntas: [
        {
          id: "ah_cus_01",
          tema: "Custo total",
          pergunta: "Você já comparou o custo recorrente da holding com o benefício econômico, sucessório e de governança esperado?",
          riscoAvaliado: "Estrutura com custo superior ao benefício.",
          importancia: 3,
        },
      ],
    },
  },
};

export function perguntasBaseDaEstrutura(estrutura, eixos = []) {
  const catalogo =
    EIXOS_PERGUNTAS[estrutura] || {};

  const ids =
    Array.isArray(eixos) && eixos.length
      ? eixos
      : Object.keys(catalogo);

  const perguntas = [];

  for (const eixoId of ids) {
    const eixo = catalogo[eixoId];

    if (!eixo) continue;

    for (const item of eixo.perguntas || []) {
      perguntas.push({
        ...item,
        areaId: eixoId,
        area: eixo.label,
      });
    }
  }

  return perguntas;
}
