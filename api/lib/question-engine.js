// api/lib/question-engine.js
// Finder — catálogo e regras de perguntas por estrutura.
// O objetivo é impedir que PF, Holding, SPE e Grupo caiam
// no checklist de empresa operacional.

export const EIXOS_PERGUNTAS = {
  operacional: {
    financeiro: {
      label: "Financeiro",
      perguntas: [
        { id: "op_fin_01", tema: "Fluxo de caixa", pergunta: "A empresa acompanha diariamente entradas, saídas e saldo disponível?", riscoAvaliado: "Baixa visibilidade de caixa.", importancia: 3 },
        { id: "op_fin_02", tema: "Projeção", pergunta: "Existe projeção de caixa para pelo menos os próximos 90 dias?", riscoAvaliado: "Baixa previsibilidade financeira.", importancia: 3 },
        { id: "op_fin_03", tema: "Rentabilidade", pergunta: "A empresa conhece margem, ponto de equilíbrio e rentabilidade por produto, serviço ou cliente?", riscoAvaliado: "Decisões sem visão clara de rentabilidade.", importancia: 3 },
      ],
    },
    tributario: {
      label: "Tributário",
      perguntas: [
        { id: "op_tri_01", tema: "Regime", pergunta: "O regime tributário atual foi revisado com base nos números reais da empresa?", riscoAvaliado: "Regime tributário possivelmente inadequado.", importancia: 3 },
        { id: "op_tri_02", tema: "Créditos e benefícios", pergunta: "A empresa revisa periodicamente créditos, benefícios e oportunidades tributárias aplicáveis?", riscoAvaliado: "Possível perda de créditos ou benefícios.", importancia: 2 },
        { id: "op_tri_03", tema: "Reforma Tributária", pergunta: "A empresa já simulou impactos de IBS/CBS em preço, margem e fluxo de caixa?", riscoAvaliado: "Baixa preparação para a Reforma Tributária.", importancia: 3 },
      ],
    },
    contabil_fiscal: {
      label: "Contábil / Fiscal",
      perguntas: [
        { id: "op_cf_01", tema: "Demonstrações", pergunta: "Balancete, DRE e demais informações contábeis são analisados com regularidade?", riscoAvaliado: "Gestão sem apoio consistente da contabilidade.", importancia: 2 },
        { id: "op_cf_02", tema: "Fiscal", pergunta: "Documentos fiscais e apurações passam por conferência periódica?", riscoAvaliado: "Risco de inconsistências fiscais.", importancia: 3 },
      ],
    },
    comercial: {
      label: "Comercial",
      perguntas: [
        { id: "op_com_01", tema: "Funil", pergunta: "Existe processo comercial com etapas e responsabilidades definidas?", riscoAvaliado: "Vendas dependentes de ações informais.", importancia: 3 },
        { id: "op_com_02", tema: "Conversão", pergunta: "A empresa acompanha taxa de conversão, ticket médio e ciclo de vendas?", riscoAvaliado: "Baixa previsibilidade comercial.", importancia: 2 },
      ],
    },
    marketing: {
      label: "Marketing",
      perguntas: [
        { id: "op_mkt_01", tema: "Aquisição", pergunta: "A empresa sabe quais canais geram mais oportunidades e clientes?", riscoAvaliado: "Investimento em marketing sem mensuração.", importancia: 2 },
        { id: "op_mkt_02", tema: "CAC / ROI", pergunta: "CAC e retorno das principais campanhas são acompanhados?", riscoAvaliado: "Custo de aquisição desconhecido.", importancia: 2 },
      ],
    },
    gestao: {
      label: "Gestão",
      perguntas: [
        { id: "op_gest_01", tema: "Indicadores", pergunta: "Existem indicadores-chave acompanhados com rotina definida?", riscoAvaliado: "Gestão sem indicadores consistentes.", importancia: 3 },
        { id: "op_gest_02", tema: "Metas", pergunta: "A empresa possui metas claras e responsáveis por sua execução?", riscoAvaliado: "Planejamento sem responsabilização.", importancia: 2 },
      ],
    },
    rh: {
      label: "Recursos Humanos",
      perguntas: [
        { id: "op_rh_01", tema: "Estrutura", pergunta: "Papéis, responsabilidades e níveis de decisão estão claros para a equipe?", riscoAvaliado: "Sobreposição ou lacunas de responsabilidade.", importancia: 2 },
        { id: "op_rh_02", tema: "Desempenho", pergunta: "A empresa acompanha desempenho, turnover, absenteísmo ou necessidade de desenvolvimento?", riscoAvaliado: "Problemas de pessoas detectados tarde.", importancia: 2 },
      ],
    },
    operacional: {
      label: "Operacional",
      perguntas: [
        { id: "op_op_01", tema: "Processos", pergunta: "Os processos críticos da operação estão documentados e possuem responsáveis?", riscoAvaliado: "Dependência excessiva de pessoas e conhecimento informal.", importancia: 3 },
        { id: "op_op_02", tema: "Capacidade", pergunta: "A empresa conhece seus gargalos, prazos e capacidade de entrega?", riscoAvaliado: "Baixa previsibilidade operacional.", importancia: 3 },
      ],
    },
    tecnologia: {
      label: "Tecnologia",
      perguntas: [
        { id: "op_tec_01", tema: "Sistemas", pergunta: "Os principais processos usam sistemas integrados ou dados ainda ficam dispersos?", riscoAvaliado: "Fragmentação de dados e retrabalho.", importancia: 2 },
        { id: "op_tec_02", tema: "Informação", pergunta: "A gestão possui dashboards ou relatórios confiáveis para decisão?", riscoAvaliado: "Decisões com informação incompleta ou atrasada.", importancia: 2 },
      ],
    },
  },

  grupo: {
    estrutura_grupo: {
      label: "Estrutura do grupo",
      perguntas: [
        { id: "grp_est_01", tema: "Função das empresas", pergunta: "Está formalmente claro qual é a função econômica e operacional de cada empresa do grupo?", riscoAvaliado: "Empresas com papéis sobrepostos ou sem justificativa econômica clara.", importancia: 3 },
        { id: "grp_est_02", tema: "Composição societária", pergunta: "A composição societária e os percentuais de participação são conhecidos e coerentes entre as empresas?", riscoAvaliado: "Estrutura societária complexa ou desorganizada.", importancia: 3 },
        { id: "grp_est_03", tema: "Justificativa da estrutura", pergunta: "Cada CNPJ do grupo possui finalidade prática e econômica claramente identificável?", riscoAvaliado: "CNPJs mantidos sem função clara, aumentando custo e risco.", importancia: 3 },
      ],
    },

    governanca: {
      label: "Governança",
      perguntas: [
        { id: "grp_gov_01", tema: "Decisões", pergunta: "Existem regras claras para decisões relevantes entre sócios e empresas do grupo?", riscoAvaliado: "Decisões concentradas ou conflitantes.", importancia: 3 },
        { id: "grp_gov_02", tema: "Ritos de gestão", pergunta: "O grupo possui reuniões, indicadores e prestação de contas em nível consolidado?", riscoAvaliado: "Baixa governança e pouca visão consolidada.", importancia: 3 },
      ],
    },

    financeiro_consolidado: {
      label: "Financeiro consolidado",
      perguntas: [
        { id: "grp_fin_01", tema: "Visão consolidada", pergunta: "O grupo consegue visualizar caixa, dívidas, recebíveis e resultado de forma consolidada?", riscoAvaliado: "Decisões financeiras sem visão global do grupo.", importancia: 3 },
        { id: "grp_fin_02", tema: "Tesouraria", pergunta: "Há regras claras para centralização de pagamentos, empréstimos internos ou uso de caixa entre empresas?", riscoAvaliado: "Confusão financeira entre empresas.", importancia: 3 },
        { id: "grp_fin_03", tema: "Rentabilidade", pergunta: "A rentabilidade de cada empresa é analisada separadamente e também no consolidado?", riscoAvaliado: "Empresas deficitárias podem ser mascaradas pelo resultado consolidado.", importancia: 3 },
      ],
    },

    intercompany: {
      label: "Operações intercompany",
      perguntas: [
        { id: "grp_int_01", tema: "Operações entre empresas", pergunta: "Mútuos, rateios, prestação de serviços, vendas ou repasses entre empresas possuem documentação e critério definidos?", riscoAvaliado: "Operações intercompany sem suporte documental.", importancia: 3 },
        { id: "grp_int_02", tema: "Precificação interna", pergunta: "Os valores cobrados entre empresas possuem critério econômico ou contratual consistente?", riscoAvaliado: "Risco fiscal e distorção de resultados entre empresas.", importancia: 3 },
      ],
    },

    tributario: {
      label: "Tributário",
      perguntas: [
        { id: "grp_tri_01", tema: "Regimes", pergunta: "Os regimes tributários das empresas são avaliados considerando o grupo como um todo?", riscoAvaliado: "Estrutura tributária fragmentada e possivelmente ineficiente.", importancia: 3 },
        { id: "grp_tri_02", tema: "Riscos fiscais", pergunta: "As operações entre empresas já foram revisadas sob a ótica fiscal e da Reforma Tributária?", riscoAvaliado: "Exposição fiscal em operações internas do grupo.", importancia: 3 },
      ],
    },

    contabil_fiscal: {
      label: "Contábil / Fiscal",
      perguntas: [
        { id: "grp_cf_01", tema: "Conciliação entre empresas", pergunta: "Saldos, mútuos e operações entre empresas são conciliados periodicamente?", riscoAvaliado: "Divergências contábeis entre partes relacionadas.", importancia: 3 },
        { id: "grp_cf_02", tema: "Fechamento", pergunta: "O grupo possui rotina de fechamento que permita comparar empresas e consolidar informações?", riscoAvaliado: "Informação gerencial inconsistente entre empresas.", importancia: 2 },
      ],
    },

    pessoas_compartilhadas: {
      label: "Pessoas compartilhadas",
      perguntas: [
        { id: "grp_pes_01", tema: "Equipe compartilhada", pergunta: "Funcionários que atendem mais de uma empresa possuem alocação, contratos e rateios compatíveis com a realidade?", riscoAvaliado: "Risco trabalhista e de rateio inadequado.", importancia: 3 },
        { id: "grp_pes_02", tema: "Estrutura compartilhada", pergunta: "Despesas comuns como aluguel, veículos, sistemas e administrativo possuem critério formal de rateio?", riscoAvaliado: "Custos distribuídos sem critério claro.", importancia: 3 },
      ],
    },

    operacoes: {
      label: "Operações do grupo",
      perguntas: [
        { id: "grp_op_01", tema: "Integração operacional", pergunta: "Os processos entre empresas são desenhados para evitar retrabalho e atividades duplicadas?", riscoAvaliado: "Ineficiência operacional entre empresas.", importancia: 2 },
        { id: "grp_op_02", tema: "Dependência", pergunta: "Alguma empresa depende criticamente de outra sem contrato, SLA ou plano de contingência?", riscoAvaliado: "Dependência operacional não formalizada.", importancia: 3 },
      ],
    },

    tecnologia: {
      label: "Tecnologia e dados",
      perguntas: [
        { id: "grp_tec_01", tema: "Sistemas", pergunta: "As empresas utilizam sistemas integrados ou uma base que permita visão consolidada?", riscoAvaliado: "Dados fragmentados e consolidação manual.", importancia: 2 },
        { id: "grp_tec_02", tema: "Indicadores", pergunta: "Existe dashboard consolidado com indicadores financeiros e operacionais do grupo?", riscoAvaliado: "Baixa capacidade de gestão consolidada.", importancia: 2 },
      ],
    },
  },

  spe: {
    projeto: {
      label: "Projeto / empreendimento",
      perguntas: [
        { id: "spe_proj_01", tema: "Escopo", pergunta: "O objeto, escopo e resultado esperado do projeto estão formalmente definidos?", riscoAvaliado: "Projeto sem escopo suficientemente claro.", importancia: 3 },
        { id: "spe_proj_02", tema: "Cronograma", pergunta: "Existe cronograma com marcos, responsáveis e critérios de acompanhamento?", riscoAvaliado: "Atrasos sem identificação precoce.", importancia: 3 },
        { id: "spe_proj_03", tema: "Viabilidade", pergunta: "A viabilidade econômica do projeto foi atualizada com dados recentes de receita, custo e prazo?", riscoAvaliado: "Projeto baseado em premissas desatualizadas.", importancia: 3 },
      ],
    },

    socios_investidores: {
      label: "Sócios e investidores",
      perguntas: [
        { id: "spe_soc_01", tema: "Papéis", pergunta: "As responsabilidades, poderes e obrigações de cada sócio/investidor estão formalizados?", riscoAvaliado: "Conflitos de governança entre participantes.", importancia: 3 },
        { id: "spe_soc_02", tema: "Retorno", pergunta: "Critérios de distribuição, retorno e eventuais chamadas adicionais de capital estão claros?", riscoAvaliado: "Expectativas financeiras divergentes entre investidores.", importancia: 3 },
      ],
    },

    aportes: {
      label: "Aportes e capital",
      perguntas: [
        { id: "spe_ap_01", tema: "Capital necessário", pergunta: "O capital total necessário para concluir o projeto foi estimado com margem para contingências?", riscoAvaliado: "Necessidade inesperada de novos aportes.", importancia: 3 },
        { id: "spe_ap_02", tema: "Chamadas de capital", pergunta: "Existem regras definidas para aportes adicionais caso o caixa fique abaixo do necessário?", riscoAvaliado: "Conflito ou paralisação por falta de capital.", importancia: 3 },
      ],
    },

    financeiro: {
      label: "Financeiro",
      perguntas: [
        { id: "spe_fin_01", tema: "Fluxo do projeto", pergunta: "Existe fluxo de caixa específico da SPE com projeção até a conclusão do projeto?", riscoAvaliado: "Baixa previsibilidade de caixa do empreendimento.", importancia: 3 },
        { id: "spe_fin_02", tema: "Orçado x realizado", pergunta: "Custos e receitas realizados são comparados periodicamente com orçamento e viabilidade original?", riscoAvaliado: "Desvios financeiros detectados tarde.", importancia: 3 },
        { id: "spe_fin_03", tema: "Rentabilidade", pergunta: "A rentabilidade projetada é recalculada quando custos, prazo ou receita mudam?", riscoAvaliado: "Retorno esperado pode não refletir a realidade atual.", importancia: 3 },
      ],
    },

    contratos: {
      label: "Contratos",
      perguntas: [
        { id: "spe_con_01", tema: "Contratos essenciais", pergunta: "Os principais contratos do projeto estão formalizados e com obrigações, garantias e penalidades claras?", riscoAvaliado: "Exposição contratual relevante.", importancia: 3 },
        { id: "spe_con_02", tema: "Dependências", pergunta: "Existem contratos críticos cuja falha pode comprometer prazo, custo ou receita do projeto?", riscoAvaliado: "Dependência contratual crítica.", importancia: 3 },
      ],
    },

    tributario: {
      label: "Tributário",
      perguntas: [
        { id: "spe_tri_01", tema: "Modelo tributário", pergunta: "A tributação do projeto foi simulada considerando a natureza das receitas, custos e fase da SPE?", riscoAvaliado: "Carga tributária subestimada ou inadequada.", importancia: 3 },
        { id: "spe_tri_02", tema: "Reforma Tributária", pergunta: "O projeto já avaliou impactos da Reforma Tributária sobre contratos, preços e fluxo financeiro?", riscoAvaliado: "Mudança tributária não incorporada à viabilidade.", importancia: 3 },
      ],
    },

    governanca: {
      label: "Governança",
      perguntas: [
        { id: "spe_gov_01", tema: "Prestação de contas", pergunta: "Existe rotina formal de prestação de contas aos sócios/investidores?", riscoAvaliado: "Baixa transparência da gestão da SPE.", importancia: 3 },
        { id: "spe_gov_02", tema: "Decisões", pergunta: "As matérias que exigem aprovação dos sócios e os respectivos quóruns estão definidos?", riscoAvaliado: "Conflito decisório e paralisação do projeto.", importancia: 3 },
      ],
    },

    riscos: {
      label: "Riscos do projeto",
      perguntas: [
        { id: "spe_ris_01", tema: "Mapa de riscos", pergunta: "Os principais riscos financeiros, jurídicos, operacionais e comerciais estão mapeados com responsáveis?", riscoAvaliado: "Riscos relevantes sem plano de resposta.", importancia: 3 },
        { id: "spe_ris_02", tema: "Contingência", pergunta: "Existem reservas ou planos de contingência para atrasos, aumento de custo ou redução de receita?", riscoAvaliado: "Baixa capacidade de absorver desvios.", importancia: 3 },
      ],
    },

    encerramento: {
      label: "Saída / encerramento",
      perguntas: [
        { id: "spe_enc_01", tema: "Encerramento", pergunta: "Existem critérios claros para conclusão, liquidação ou encerramento da SPE?", riscoAvaliado: "SPE pode permanecer ativa sem finalidade após o projeto.", importancia: 2 },
        { id: "spe_enc_02", tema: "Saída de sócio", pergunta: "Há regra para saída, substituição ou inadimplemento de sócio/investidor?", riscoAvaliado: "Conflito societário sem mecanismo de solução.", importancia: 3 },
      ],
    },
  },

  holding: {
    patrimonio: {
      label: "Patrimônio",
      perguntas: [
        { id: "hol_pat_01", tema: "Inventário patrimonial", pergunta: "A holding possui relação atualizada dos bens, direitos, participações e obrigações que compõem seu patrimônio?", riscoAvaliado: "Patrimônio da holding sem visão consolidada.", importancia: 3 },
        { id: "hol_pat_02", tema: "Aderência", pergunta: "Os ativos atualmente na holding estão alinhados ao objetivo para o qual a estrutura foi criada?", riscoAvaliado: "Holding com ativos ou funções desconectados de sua finalidade.", importancia: 3 },
        { id: "hol_pat_03", tema: "Movimentações", pergunta: "Entradas e saídas de bens da holding passam por análise jurídica, tributária e econômica prévia?", riscoAvaliado: "Movimentações patrimoniais com custo ou risco não antecipado.", importancia: 3 },
      ],
    },

    participacoes: {
      label: "Participações societárias",
      perguntas: [
        { id: "hol_part_01", tema: "Participações", pergunta: "As participações societárias detidas pela holding estão atualizadas e formalmente registradas?", riscoAvaliado: "Participações desatualizadas ou inconsistentes.", importancia: 3 },
        { id: "hol_part_02", tema: "Controle", pergunta: "Direitos de voto, administração e distribuição de resultados das investidas estão claramente definidos?", riscoAvaliado: "Controle e governança societária frágeis.", importancia: 3 },
      ],
    },

    imoveis: {
      label: "Imóveis",
      perguntas: [
        { id: "hol_im_01", tema: "Titularidade", pergunta: "Os imóveis da estrutura estão corretamente registrados e compatíveis com a finalidade da holding?", riscoAvaliado: "Titularidade ou uso dos imóveis pode não refletir a estrutura planejada.", importancia: 3 },
        { id: "hol_im_02", tema: "Contratos", pergunta: "Locações, cessões ou uso de imóveis por empresas/familiares estão formalizados?", riscoAvaliado: "Uso patrimonial sem documentação adequada.", importancia: 3 },
        { id: "hol_im_03", tema: "Financiamentos", pergunta: "Existem imóveis financiados, dados em garantia ou sujeitos a restrições que afetem a estrutura?", riscoAvaliado: "Restrições financeiras ou contratuais sobre ativos.", importancia: 3 },
      ],
    },

    receitas_patrimoniais: {
      label: "Receitas patrimoniais",
      perguntas: [
        { id: "hol_rec_01", tema: "Receitas", pergunta: "As receitas de aluguel, dividendos, juros e alienações estão separadas e acompanhadas por natureza?", riscoAvaliado: "Receitas patrimoniais sem análise adequada.", importancia: 3 },
        { id: "hol_rec_02", tema: "Resultado", pergunta: "A holding acompanha resultado, fluxo de caixa e distribuição de recursos aos sócios?", riscoAvaliado: "Baixa visão econômica da estrutura.", importancia: 2 },
      ],
    },

    tributario_patrimonial: {
      label: "Tributário patrimonial",
      perguntas: [
        { id: "hol_tri_01", tema: "Eficiência tributária", pergunta: "A carga tributária da holding é comparada periodicamente com alternativas possíveis na pessoa física ou em outras estruturas?", riscoAvaliado: "Estrutura mantida sem validação de eficiência tributária.", importancia: 3 },
        { id: "hol_tri_02", tema: "Operações", pergunta: "Alienações, locações, dividendos e integralizações são simuladas antes de serem realizadas?", riscoAvaliado: "Eventos patrimoniais com tributação inesperada.", importancia: 3 },
        { id: "hol_tri_03", tema: "Reforma Tributária", pergunta: "A holding já avaliou como a Reforma Tributária pode afetar suas receitas e operações imobiliárias?", riscoAvaliado: "Estrutura patrimonial sem planejamento para novas regras.", importancia: 3 },
      ],
    },

    governanca: {
      label: "Governança",
      perguntas: [
        { id: "hol_gov_01", tema: "Administração", pergunta: "As regras de administração, voto e tomada de decisão estão claras no contrato social e acordos existentes?", riscoAvaliado: "Governança insuficiente para a finalidade patrimonial/familiar.", importancia: 3 },
        { id: "hol_gov_02", tema: "Prestação de contas", pergunta: "Sócios e familiares recebem informações periódicas sobre patrimônio, receitas e decisões relevantes?", riscoAvaliado: "Baixa transparência entre participantes.", importancia: 2 },
      ],
    },

    sucessao: {
      label: "Sucessão",
      perguntas: [
        { id: "hol_suc_01", tema: "Plano sucessório", pergunta: "A sucessão das quotas e do controle da holding está planejada e documentada?", riscoAvaliado: "Sucessão patrimonial incompleta ou inexistente.", importancia: 3 },
        { id: "hol_suc_02", tema: "Doação / usufruto", pergunta: "Doações, usufruto, administração e direitos dos herdeiros foram estruturados de acordo com os objetivos familiares?", riscoAvaliado: "Instrumentos sucessórios desconectados do objetivo real.", importancia: 3 },
        { id: "hol_suc_03", tema: "Herdeiros", pergunta: "Há regras para situações em que herdeiros possuem interesses ou capacidades de gestão diferentes?", riscoAvaliado: "Potencial conflito entre herdeiros.", importancia: 3 },
      ],
    },

    protecao_patrimonial: {
      label: "Proteção patrimonial",
      perguntas: [
        { id: "hol_pro_01", tema: "Separação patrimonial", pergunta: "A separação entre patrimônio pessoal, patrimônio da holding e patrimônio das empresas operacionais é respeitada na prática?", riscoAvaliado: "Confusão patrimonial.", importancia: 3 },
        { id: "hol_pro_02", tema: "Garantias", pergunta: "Bens da holding são utilizados como garantia de obrigações pessoais ou de empresas operacionais?", riscoAvaliado: "Exposição patrimonial da holding.", importancia: 3 },
      ],
    },

    custos_estrutura: {
      label: "Custos da estrutura",
      perguntas: [
        { id: "hol_cus_01", tema: "Custo recorrente", pergunta: "Os custos contábeis, jurídicos, administrativos e tributários da holding são conhecidos e acompanhados?", riscoAvaliado: "Estrutura com custo não monitorado.", importancia: 2 },
        { id: "hol_cus_02", tema: "Benefício x custo", pergunta: "Os benefícios patrimoniais, sucessórios e tributários justificam os custos e a complexidade atual da holding?", riscoAvaliado: "Holding mantida sem benefício proporcional ao custo.", importancia: 3 },
      ],
    },
  },

  avaliar_holding: {
    objetivos: {
      label: "Objetivos da estrutura",
      perguntas: [
        { id: "ah_obj_01", tema: "Finalidade", pergunta: "O principal objetivo é organização patrimonial, sucessão, governança, tributação ou centralização de participações?", riscoAvaliado: "Estrutura criada sem objetivo claramente definido.", importancia: 3 },
        { id: "ah_obj_02", tema: "Resultado esperado", pergunta: "Você consegue explicar qual problema espera resolver com uma holding?", riscoAvaliado: "Risco de criar estrutura sem benefício mensurável.", importancia: 3 },
      ],
    },
    patrimonio: {
      label: "Patrimônio",
      perguntas: [
        { id: "ah_pat_01", tema: "Composição patrimonial", pergunta: "Você possui uma relação dos principais bens que poderiam fazer parte da estrutura?", riscoAvaliado: "Patrimônio não mapeado antes da análise.", importancia: 3 },
        { id: "ah_pat_02", tema: "Titularidade", pergunta: "Está claro quais bens estão na pessoa física, em empresas e em copropriedade?", riscoAvaliado: "Titularidade fragmentada e custo de reorganização não conhecido.", importancia: 3 },
      ],
    },
    imoveis: {
      label: "Imóveis",
      perguntas: [
        { id: "ah_im_01", tema: "Imóveis", pergunta: "Há imóveis próprios, financiados, alugados ou utilizados por empresas da família?", riscoAvaliado: "Tratamentos jurídicos e tributários distintos não mapeados.", importancia: 3 },
        { id: "ah_im_02", tema: "Movimentação futura", pergunta: "Existe intenção de comprar, vender, doar ou integralizar imóveis nos próximos anos?", riscoAvaliado: "Reorganização sem considerar eventos futuros relevantes.", importancia: 3 },
      ],
    },
    participacoes: {
      label: "Participações societárias",
      perguntas: [
        { id: "ah_part_01", tema: "Empresas", pergunta: "Você ou sua família possuem participações em empresas operacionais ou investimentos societários?", riscoAvaliado: "Participações fora do planejamento patrimonial.", importancia: 3 },
        { id: "ah_part_02", tema: "Controle", pergunta: "Existem regras claras de controle, voto, administração e distribuição de resultados nessas empresas?", riscoAvaliado: "Governança societária insuficiente.", importancia: 2 },
      ],
    },
    receitas: {
      label: "Receitas patrimoniais",
      perguntas: [
        { id: "ah_rec_01", tema: "Renda patrimonial", pergunta: "Há receitas relevantes de aluguel, dividendos, juros, venda de bens ou outras fontes patrimoniais?", riscoAvaliado: "Estrutura proposta sem análise das fontes reais de receita.", importancia: 3 },
      ],
    },
    familia_sucessao: {
      label: "Família e sucessão",
      perguntas: [
        { id: "ah_suc_01", tema: "Herdeiros", pergunta: "Há herdeiros e já existe alguma definição sobre administração e transmissão do patrimônio?", riscoAvaliado: "Sucessão sem regras claras.", importancia: 3 },
        { id: "ah_suc_02", tema: "Conflitos", pergunta: "Existem diferenças relevantes de participação, interesse ou capacidade de gestão entre os herdeiros?", riscoAvaliado: "Potencial conflito sucessório.", importancia: 3 },
      ],
    },
    tributario: {
      label: "Tributário patrimonial",
      perguntas: [
        { id: "ah_tri_01", tema: "Carga atual", pergunta: "Você conhece a tributação atual sobre aluguéis, ganhos de capital, dividendos e demais rendas patrimoniais?", riscoAvaliado: "Comparação PF x holding sem base tributária atual.", importancia: 3 },
        { id: "ah_tri_02", tema: "Comparação", pergunta: "Já foi feita uma simulação completa dos custos de constituição, manutenção e tributação da holding?", riscoAvaliado: "Decisão baseada apenas em percepção de economia tributária.", importancia: 3 },
      ],
    },
    financiamentos: {
      label: "Financiamentos e obrigações",
      perguntas: [
        { id: "ah_fin_01", tema: "Financiamentos", pergunta: "Existem imóveis ou ativos financiados, dados em garantia ou vinculados a contratos que possam dificultar a transferência?", riscoAvaliado: "Restrição contratual ou financeira à reorganização.", importancia: 3 },
      ],
    },
    custos_viabilidade: {
      label: "Custos e viabilidade",
      perguntas: [
        { id: "ah_cus_01", tema: "Custo total", pergunta: "Você já comparou o custo recorrente da holding com o benefício econômico, sucessório e de governança esperado?", riscoAvaliado: "Estrutura com custo superior ao benefício.", importancia: 3 },
      ],
    },
  },

  pessoa_fisica: {
    organizacao_financeira: {
      label: "Organização financeira",
      perguntas: [
        { id: "pf_org_01", tema: "Controle financeiro", pergunta: "Você acompanha mensalmente quanto recebe, quanto gasta e quanto efetivamente consegue poupar?", riscoAvaliado: "Baixa visibilidade sobre a própria situação financeira.", importancia: 3 },
        { id: "pf_org_02", tema: "Orçamento", pergunta: "Você possui um orçamento mensal com limites ou metas para os principais grupos de gastos?", riscoAvaliado: "Gastos sem referência objetiva de controle.", importancia: 2 },
        { id: "pf_org_03", tema: "Previsibilidade", pergunta: "Você consegue prever seus principais compromissos financeiros dos próximos 90 dias?", riscoAvaliado: "Decisões financeiras reativas e baixa previsibilidade.", importancia: 2 },
      ],
    },
    fluxo_pessoal: {
      label: "Fluxo financeiro pessoal",
      perguntas: [
        { id: "pf_flux_01", tema: "Sobra mensal", pergunta: "Na maior parte dos meses, sua renda é suficiente para pagar todos os gastos e ainda gerar sobra?", riscoAvaliado: "Baixa capacidade de formação de reserva e patrimônio.", importancia: 3 },
        { id: "pf_flux_02", tema: "Renda variável", pergunta: "Se sua renda variar ou cair por alguns meses, você consegue manter seus compromissos sem recorrer a crédito?", riscoAvaliado: "Dependência excessiva da renda corrente.", importancia: 3 },
      ],
    },
    endividamento: {
      label: "Endividamento",
      perguntas: [
        { id: "pf_div_01", tema: "Mapa de dívidas", pergunta: "Você conhece o saldo, a taxa de juros, a parcela e o prazo de todas as suas dívidas?", riscoAvaliado: "Dívidas sem priorização baseada em custo e impacto.", importancia: 3 },
        { id: "pf_div_02", tema: "Comprometimento da renda", pergunta: "As parcelas de dívidas comprometem uma parte relevante da sua renda mensal?", riscoAvaliado: "Baixa flexibilidade financeira.", importancia: 3 },
        { id: "pf_div_03", tema: "Crédito rotativo", pergunta: "Você utiliza rotativo do cartão, cheque especial ou crédito de curto prazo para fechar o mês?", riscoAvaliado: "Uso recorrente de crédito caro.", importancia: 3 },
      ],
    },
    reserva_seguranca: {
      label: "Reserva e segurança",
      perguntas: [
        { id: "pf_res_01", tema: "Reserva de emergência", pergunta: "Você possui uma reserva financeira separada exclusivamente para imprevistos?", riscoAvaliado: "Ausência de proteção contra eventos inesperados.", importancia: 3 },
        { id: "pf_res_02", tema: "Cobertura", pergunta: "Essa reserva seria suficiente para cobrir vários meses dos seus gastos essenciais?", riscoAvaliado: "Reserva insuficiente para o padrão de despesas.", importancia: 3 },
      ],
    },
    patrimonio: {
      label: "Patrimônio",
      perguntas: [
        { id: "pf_pat_01", tema: "Visão patrimonial", pergunta: "Você possui uma relação atualizada dos seus bens, investimentos, participações e dívidas?", riscoAvaliado: "Patrimônio fragmentado e sem visão consolidada.", importancia: 2 },
        { id: "pf_pat_02", tema: "Concentração", pergunta: "Você sabe quanto do seu patrimônio está concentrado em imóveis, empresas e investimentos financeiros?", riscoAvaliado: "Concentração patrimonial não monitorada.", importancia: 2 },
      ],
    },
    investimentos: {
      label: "Investimentos",
      perguntas: [
        { id: "pf_inv_01", tema: "Objetivos", pergunta: "Seus investimentos estão organizados de acordo com objetivos e prazos definidos?", riscoAvaliado: "Carteira sem relação clara com objetivos financeiros.", importancia: 3 },
        { id: "pf_inv_02", tema: "Liquidez", pergunta: "Você separa reserva de emergência, objetivos de curto prazo e investimentos de longo prazo?", riscoAvaliado: "Liquidez inadequada para necessidades futuras.", importancia: 3 },
        { id: "pf_inv_03", tema: "Conhecimento de risco", pergunta: "Você entende o risco, a liquidez e a finalidade dos principais investimentos que possui?", riscoAvaliado: "Produtos ou estratégias possivelmente incompatíveis com o objetivo.", importancia: 2 },
      ],
    },
    aposentadoria: {
      label: "Aposentadoria",
      perguntas: [
        { id: "pf_apo_01", tema: "Idade-alvo", pergunta: "Você já definiu em que idade gostaria de reduzir ou encerrar sua atividade profissional?", riscoAvaliado: "Aposentadoria sem horizonte temporal definido.", importancia: 2 },
        { id: "pf_apo_02", tema: "Renda desejada", pergunta: "Você sabe qual renda mensal gostaria de ter na aposentadoria, em valores atuais?", riscoAvaliado: "Meta de aposentadoria sem referência de renda.", importancia: 3 },
        { id: "pf_apo_03", tema: "Patrimônio-alvo", pergunta: "Você sabe aproximadamente quanto patrimônio precisa acumular para sustentar essa renda?", riscoAvaliado: "Meta de aposentadoria sem patrimônio-alvo.", importancia: 3 },
        { id: "pf_apo_04", tema: "Aporte", pergunta: "Você conhece quanto precisaria investir mensalmente para atingir seu objetivo de aposentadoria?", riscoAvaliado: "Distância entre objetivo futuro e aporte atual desconhecida.", importancia: 3 },
      ],
    },
    protecao_familiar: {
      label: "Proteção familiar",
      perguntas: [
        { id: "pf_prot_01", tema: "Dependentes", pergunta: "Existem pessoas que dependem financeiramente da sua renda?", riscoAvaliado: "Dependentes expostos a interrupção de renda.", importancia: 3 },
        { id: "pf_prot_02", tema: "Proteção", pergunta: "Você já avaliou como sua família manteria os principais compromissos caso sua renda fosse interrompida?", riscoAvaliado: "Proteção familiar insuficiente.", importancia: 3 },
      ],
    },
    tributario_pf: {
      label: "Tributário PF",
      perguntas: [
        { id: "pf_tri_01", tema: "IRPF", pergunta: "Sua declaração de imposto de renda reflete corretamente suas fontes de renda, bens, investimentos e dívidas?", riscoAvaliado: "Risco de inconsistências fiscais ou patrimoniais.", importancia: 3 },
        { id: "pf_tri_02", tema: "Rendas adicionais", pergunta: "Você recebe aluguéis, rendimentos do exterior, atividade autônoma ou outras receitas além do salário/pró-labore?", riscoAvaliado: "Receitas com tratamento tributário específico não mapeadas.", importancia: 2 },
      ],
    },
    sucessao: {
      label: "Sucessão",
      perguntas: [
        { id: "pf_suc_01", tema: "Organização sucessória", pergunta: "Você já avaliou como seus bens e participações seriam transmitidos aos herdeiros?", riscoAvaliado: "Sucessão patrimonial sem planejamento.", importancia: 2 },
        { id: "pf_suc_02", tema: "Complexidade patrimonial", pergunta: "Seu patrimônio inclui imóveis, empresas ou ativos cuja divisão entre herdeiros pode ser complexa?", riscoAvaliado: "Possibilidade de conflito ou perda de eficiência na sucessão.", importancia: 2 },
      ],
    },
    objetivos: {
      label: "Objetivos",
      perguntas: [
        { id: "pf_obj_01", tema: "Prioridade", pergunta: "Você possui um objetivo financeiro principal claramente definido para os próximos 3 anos?", riscoAvaliado: "Recursos dispersos entre prioridades concorrentes.", importancia: 3 },
        { id: "pf_obj_02", tema: "Plano", pergunta: "Esse objetivo possui valor, prazo e uma estratégia de acompanhamento?", riscoAvaliado: "Objetivo sem plano mensurável de execução.", importancia: 3 },
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
