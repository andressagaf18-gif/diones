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

  terceiro_setor: {
    governanca_estatutaria: {
      label: "Governança estatutária",
      perguntas: [
        { id:"ts_gov_01", tema:"Estatuto", pergunta:"O estatuto está atualizado e representa as atividades efetivamente realizadas pela entidade?", riscoAvaliado:"Atuação diferente da finalidade ou das regras estatutárias.", importancia:3 },
        { id:"ts_gov_02", tema:"Mandatos", pergunta:"Os mandatos e poderes dos dirigentes estão formalmente atualizados?", riscoAvaliado:"Atos praticados por representantes sem poderes atualizados.", importancia:3 },
        { id:"ts_gov_03", tema:"Deliberações", pergunta:"As decisões relevantes são registradas em atas e aprovadas conforme o estatuto?", riscoAvaliado:"Decisões sem suporte formal ou rastreabilidade.", importancia:3 },
      ],
    },
    prestacao_contas: {
      label: "Prestação de contas",
      perguntas: [
        { id:"ts_pc_01", tema:"Fechamento", pergunta:"A entidade realiza fechamento contábil e financeiro com periodicidade definida?", riscoAvaliado:"Prestação de contas baseada em informações atrasadas ou incompletas.", importancia:3 },
        { id:"ts_pc_02", tema:"Aprovação", pergunta:"As contas são apresentadas e aprovadas pelo órgão competente da entidade?", riscoAvaliado:"Prestação de contas sem aprovação formal.", importancia:3 },
        { id:"ts_pc_03", tema:"Documentação", pergunta:"Os documentos que sustentam receitas e despesas são organizados e preservados?", riscoAvaliado:"Movimentações sem comprovação documental suficiente.", importancia:3 },
      ],
    },
    financeiro_entidade: {
      label: "Financeiro da entidade",
      perguntas: [
        { id:"ts_fin_01", tema:"Conciliação", pergunta:"Os extratos bancários são conciliados com o controle financeiro?", riscoAvaliado:"Diferenças financeiras não identificadas tempestivamente.", importancia:3 },
        { id:"ts_fin_02", tema:"Contabilidade", pergunta:"Os saldos do controle financeiro são conciliados com a contabilidade?", riscoAvaliado:"Divergência entre a gestão financeira e os registros contábeis.", importancia:3 },
        { id:"ts_fin_03", tema:"Previsão", pergunta:"Existe previsão de recebimentos e pagamentos para os próximos 90 dias?", riscoAvaliado:"Baixa previsibilidade de caixa.", importancia:3 },
        { id:"ts_fin_04", tema:"Orçamento", pergunta:"A entidade possui orçamento anual formalmente aprovado?", riscoAvaliado:"Uso de recursos sem referência orçamentária.", importancia:3 },
      ],
    },
    receitas_entidade: {
      label: "Receitas e recursos",
      perguntas: [
        { id:"ts_rec_01", tema:"Segregação", pergunta:"Mensalidades, doações, subvenções, locações e outras receitas são registradas separadamente?", riscoAvaliado:"Receitas de naturezas diferentes tratadas de forma indistinta.", importancia:3 },
        { id:"ts_rec_02", tema:"Mensalidades", pergunta:"Existe controle atualizado das mensalidades e da inadimplência dos associados?", riscoAvaliado:"Perda de receita e baixa previsibilidade de recebimento.", importancia:3 },
        { id:"ts_rec_03", tema:"Aplicação", pergunta:"A aplicação dos recursos é acompanhada de acordo com sua finalidade?", riscoAvaliado:"Recursos aplicados sem vínculo demonstrável com a finalidade institucional.", importancia:3 },
      ],
    },
    contratos_terceiro_setor: {
      label: "Contratos e instrumentos",
      perguntas: [
        { id:"ts_con_01", tema:"Formalização", pergunta:"Os contratos de locação, cessão ou uso dos espaços estão formalizados por escrito?", riscoAvaliado:"Receitas e responsabilidades contratuais sem formalização.", importancia:3 },
        { id:"ts_con_02", tema:"Vigência", pergunta:"Existe controle de vencimento e renovação dos contratos?", riscoAvaliado:"Perda de prazo ou continuidade contratual sem revisão.", importancia:2 },
        { id:"ts_con_03", tema:"Parcerias", pergunta:"Parcerias, convênios e repasses possuem instrumentos e prestações de contas definidos?", riscoAvaliado:"Recursos de terceiros sem regras e evidências suficientes.", importancia:3 },
      ],
    },
    tributario_terceiro_setor: {
      label: "Tributário e conformidade",
      perguntas: [
        { id:"ts_tri_01", tema:"Enquadramento", pergunta:"As imunidades e isenções utilizadas foram revisadas conforme as atividades e receitas atuais?", riscoAvaliado:"Benefício tributário aplicado sem atendimento integral dos requisitos.", importancia:3 },
        { id:"ts_tri_02", tema:"Obrigações", pergunta:"As obrigações fiscais, contábeis e trabalhistas são entregues e conferidas regularmente?", riscoAvaliado:"Inconsistências ou omissões em obrigações acessórias.", importancia:3 },
        { id:"ts_tri_03", tema:"Receitas próprias", pergunta:"As receitas de locação e outras atividades próprias possuem tratamento tributário validado?", riscoAvaliado:"Receitas acessórias com tratamento fiscal inadequado.", importancia:3 },
      ],
    },
    operacao_entidade: {
      label: "Operação da entidade",
      perguntas: [
        { id:"ts_op_01", tema:"Responsáveis", pergunta:"Os principais processos possuem responsáveis definidos?", riscoAvaliado:"Atividades dependentes de conhecimento informal.", importancia:2 },
        { id:"ts_op_02", tema:"Procedimentos", pergunta:"Existem orientações documentadas para executar os principais processos?", riscoAvaliado:"Retrabalho e execução inconsistente.", importancia:2 },
        { id:"ts_op_03", tema:"Espaços", pergunta:"Reservas e utilização dos espaços são registradas em um controle centralizado?", riscoAvaliado:"Conflitos, perda de receita ou ocupação sem rastreabilidade.", importancia:2 },
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
  abertura_empresa: {
    atividade_pretendida: {
      label: "Atividade pretendida e CNAE",
      perguntas: [
        { id: "ab_atv_01", tema: "Atividade", pergunta: "Você já definiu com clareza o que será vendido ou prestado, sejam produtos, serviços ou ambos?", riscoAvaliado: "Abertura com atividade mal definida e CNAE inadequado.", importancia: 3 },
        { id: "ab_atv_02", tema: "CNAE", pergunta: "Os CNAEs escolhidos foram conferidos com a atividade que você realmente pretende exercer?", riscoAvaliado: "Enquadramento em CNAE que não representa a operação real.", importancia: 3 },
        { id: "ab_atv_03", tema: "Atividades secundárias", pergunta: "Você já identificou se haverá atividades secundárias, por exemplo vender produtos e também prestar serviços?", riscoAvaliado: "Atividades mistas sem enquadramento adequado.", importancia: 2 },
        { id: "ab_atv_04", tema: "Público", pergunta: "Você já definiu quem serão seus primeiros clientes, sejam pessoas físicas, empresas ou ambos?", riscoAvaliado: "Modelo comercial indefinido para o início.", importancia: 2 },
      ],
    },
    enquadramento_societario: {
      label: "Enquadramento societário",
      perguntas: [
        { id: "ab_soc_01", tema: "Tipo jurídico", pergunta: "Você já avaliou o tipo jurídico mais adequado entre MEI, empresário individual e sociedade limitada?", riscoAvaliado: "Escolha do tipo de empresa sem análise da atividade e do porte.", importancia: 3 },
        { id: "ab_soc_02", tema: "Sócios", pergunta: "Havendo sócios, já está definido quem serão e a participação de cada um?", riscoAvaliado: "Conflitos e lacunas na sociedade desde o início.", importancia: 3 },
        { id: "ab_soc_03", tema: "Acordo entre sócios", pergunta: "Existe algum acordo, escrito ou combinado, sobre funções, retirada de lucros e saída de sócios?", riscoAvaliado: "Sociedade sem regras para decisões, retiradas e saída.", importancia: 2 },
        { id: "ab_soc_04", tema: "Impedimentos", pergunta: "Você já verificou se você ou os sócios têm algum impedimento para abrir ou participar da empresa?", riscoAvaliado: "Impedimento legal descoberto só depois da abertura.", importancia: 2 },
      ],
    },
    regime_tributario_abertura: {
      label: "Regime tributário",
      perguntas: [
        { id: "ab_reg_01", tema: "Faturamento projetado", pergunta: "Você já estimou o faturamento mensal esperado para os primeiros 12 meses?", riscoAvaliado: "Regime escolhido sem base numérica.", importancia: 3 },
        { id: "ab_reg_02", tema: "Regime", pergunta: "O regime tributário foi escolhido com base na atividade e no faturamento estimado?", riscoAvaliado: "Regime possivelmente inadequado desde o início.", importancia: 3 },
        { id: "ab_reg_03", tema: "Limites", pergunta: "Você conhece os limites de faturamento do MEI e do Simples Nacional e sabe se a sua projeção cabe neles?", riscoAvaliado: "Risco de desenquadramento logo no primeiro ano.", importancia: 3 },
        { id: "ab_reg_04", tema: "Obrigações", pergunta: "Você já sabe que impostos e obrigações terá logo depois de abrir?", riscoAvaliado: "Surpresa com tributos e obrigações acessórias.", importancia: 2 },
        { id: "ab_reg_05", tema: "Reforma Tributária", pergunta: "Você já considerou o efeito da Reforma Tributária (IBS/CBS) no preço e na margem do seu negócio?", riscoAvaliado: "Precificação sem considerar a transição tributária.", importancia: 2 },
      ],
    },
    licencas_registros: {
      label: "Licenças e registros",
      perguntas: [
        { id: "ab_lic_01", tema: "Licenças", pergunta: "Você já levantou as licenças e alvarás exigidos pela atividade, incluindo prefeitura, vigilância sanitária, bombeiros e meio ambiente?", riscoAvaliado: "Início da operação sem licença obrigatória.", importancia: 3 },
        { id: "ab_lic_02", tema: "Registro profissional", pergunta: "Se a atividade exigir registro em conselho de classe ou responsável técnico, isso já está resolvido?", riscoAvaliado: "Atividade regulamentada sem registro ou responsável técnico.", importancia: 3 },
        { id: "ab_lic_03", tema: "Local", pergunta: "O local escolhido permite a atividade pretendida, considerando uso do solo, zoneamento e contrato de locação?", riscoAvaliado: "Local incompatível com a atividade e retrabalho na abertura.", importancia: 3 },
        { id: "ab_lic_04", tema: "Prazos", pergunta: "Você conhece os prazos de cada licença e sabe o que precisa estar pronto antes de começar a operar?", riscoAvaliado: "Atraso na abertura por prazos não mapeados.", importancia: 2 },
      ],
    },
    estrutura_inicial: {
      label: "Estrutura inicial",
      perguntas: [
        { id: "ab_est_01", tema: "Capital", pergunta: "Você já definiu o valor disponível para abrir e manter a empresa nos primeiros meses?", riscoAvaliado: "Abertura sem capital planejado.", importancia: 3 },
        { id: "ab_est_02", tema: "Reserva", pergunta: "Existe reserva para cobrir os custos fixos por 3 a 6 meses sem faturamento?", riscoAvaliado: "Risco de caixa nos primeiros meses de operação.", importancia: 3 },
        { id: "ab_est_03", tema: "Separação financeira", pergunta: "Você pretende separar as finanças da empresa das suas finanças pessoais desde o início, com conta bancária PJ?", riscoAvaliado: "Mistura de patrimônio pessoal e empresarial.", importancia: 2 },
        { id: "ab_est_04", tema: "Equipe", pergunta: "Havendo funcionários desde o início, você já conhece os custos e as obrigações trabalhistas?", riscoAvaliado: "Custo de pessoal e encargos subestimados.", importancia: 2 },
        { id: "ab_est_05", tema: "Sistemas", pergunta: "Você já definiu a forma de emitir notas fiscais e de controlar vendas e financeiro?", riscoAvaliado: "Operação iniciada sem emissão fiscal e controle básico.", importancia: 2 },
      ],
    },
    prazo_custos_abertura: {
      label: "Prazo e custos de abertura",
      perguntas: [
        { id: "ab_prz_01", tema: "Prazo", pergunta: "Você tem uma data-alvo para começar a operar e sabe se ela é realista diante das licenças exigidas?", riscoAvaliado: "Expectativa de prazo incompatível com a burocracia.", importancia: 2 },
        { id: "ab_prz_02", tema: "Custos de abertura", pergunta: "Você já levantou os custos de abrir, incluindo taxas, registro, licenças, contador e adaptação do local?", riscoAvaliado: "Custo inicial maior que o previsto.", importancia: 3 },
        { id: "ab_prz_03", tema: "Custos mensais", pergunta: "Você já estimou os custos mensais fixos da empresa, incluindo contador, impostos, aluguel e sistemas?", riscoAvaliado: "Estrutura de custos fixos sem previsão.", importancia: 3 },
        { id: "ab_prz_04", tema: "Assessoria", pergunta: "Você já conta com contador ou assessoria para conduzir a abertura e os primeiros meses?", riscoAvaliado: "Abertura sem acompanhamento técnico.", importancia: 2 },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// REFORMA TRIBUTÁRIA — catálogo próprio (usado como base e como fallback sem IA).
// Todas as perguntas são afirmações respondíveis em Sim / Parcial / Não / Não sei / N/A.
// ---------------------------------------------------------------------------
const q = (id, tema, pergunta, riscoAvaliado, importancia = 3) => ({ id, tema, pergunta, riscoAvaliado, importancia });

EIXOS_PERGUNTAS.reforma_tributaria = {
  reforma_carga: {
    label: "Carga tributária e cenários",
    perguntas: [
      q("rf_car_01", "Carga atual", "A empresa conhece a carga tributária atual sobre o faturamento, separando cada tributo?", "Sem a carga atual não há como comparar com a Reforma."),
      q("rf_car_02", "Comparação", "Já foi feita uma comparação entre a carga atual e a carga estimada com IBS e CBS?", "Impacto da Reforma desconhecido."),
      q("rf_car_03", "Caixa", "A empresa projeta o efeito da Reforma sobre o caixa mensal durante a transição?", "Surpresa no fluxo de caixa durante a transição.", 2),
      q("rf_car_04", "Premissas", "As premissas usadas nas simulações (alíquota, redução e enquadramento da atividade) foram validadas por um profissional?", "Decisão baseada em premissas não confirmadas.", 2),
    ],
  },
  reforma_creditos: {
    label: "Créditos de IBS/CBS",
    perguntas: [
      q("rf_cre_01", "Mapeamento", "As compras e despesas são registradas de forma que permita identificar o que poderá gerar crédito de IBS e CBS?", "Perda de créditos por falta de registro."),
      q("rf_cre_02", "Fornecedores", "A empresa identifica os fornecedores que emitem documento fiscal com direito a crédito de IBS e CBS?", "Créditos perdidos por fornecedor sem documento adequado."),
      q("rf_cre_03", "Regra atual", "Existe controle do que hoje gera crédito de PIS, Cofins, ICMS ou IPI e do que mudará com a Reforma?", "Mudança de crédito não mapeada.", 2),
      q("rf_cre_04", "Informalidade", "Despesas pagas sem nota fiscal ou fora do fluxo formal já foram mapeadas?", "Despesa sem crédito encarece a operação.", 2),
    ],
  },
  reforma_precos: {
    label: "Preço, margem e repasse",
    perguntas: [
      q("rf_pre_01", "Margem", "A empresa conhece a margem por produto, serviço ou cliente?", "Preço sem base de margem."),
      q("rf_pre_02", "Simulação de preço", "Já foi feita uma simulação do preço de venda com os novos tributos, mantendo a margem?", "Perda de margem na transição."),
      q("rf_pre_03", "Repasse", "A empresa consegue repassar variação de custo tributário ao cliente sem perder vendas?", "Absorção do custo tributário pela empresa."),
      q("rf_pre_04", "Política comercial", "Descontos, promoções e condições comerciais foram revisados considerando a nova tributação?", "Política comercial desalinhada com a nova carga.", 2),
    ],
  },
  reforma_clientes: {
    label: "Clientes e modelo B2B/B2C",
    perguntas: [
      q("rf_cli_01", "Perfil de venda", "A empresa tem separadas as vendas para empresas (B2B) e as vendas para consumidor final (B2C)?", "Efeito da Reforma estimado sem conhecer o perfil de venda."),
      q("rf_cli_02", "Crédito do cliente", "Os clientes que são empresas exigem nota fiscal que lhes permita aproveitar crédito de IBS e CBS?", "Perda de competitividade perante clientes que dependem de crédito."),
      q("rf_cli_03", "Efeito nos clientes", "Existe análise do efeito da mudança de tributação sobre a decisão de compra dos principais clientes?", "Risco de perder clientes relevantes.", 2),
    ],
  },
  reforma_fornecedores: {
    label: "Fornecedores e cadeia de créditos",
    perguntas: [
      q("rf_for_01", "Regime do fornecedor", "Os principais fornecedores estão classificados pelo regime tributário (Simples, Presumido ou Real)?", "Crédito aproveitável desconhecido."),
      q("rf_for_02", "Efeito no crédito", "A empresa avalia o efeito do regime do fornecedor no crédito que poderá aproveitar?", "Compra de quem gera menos crédito sem perceber."),
      q("rf_for_03", "Plano com fornecedores", "Há conversa ou plano com fornecedores estratégicos sobre documentos fiscais e preços na Reforma?", "Surpresa de preço e documentação na cadeia.", 2),
    ],
  },
  reforma_fiscal: {
    label: "Notas fiscais e parametrização",
    perguntas: [
      q("rf_fis_01", "Cadastros", "O cadastro de produtos e serviços (NCM, NBS e CNAE) está atualizado e conferido?", "Notas com classificação errada."),
      q("rf_fis_02", "Conferência", "As notas fiscais emitidas passam por conferência de tributos e informações antes do envio?", "Erro recorrente em documento fiscal."),
      q("rf_fis_03", "Acompanhamento", "A empresa acompanha as mudanças de campos e regras dos documentos fiscais ligadas à Reforma?", "Notas rejeitadas por mudança de regra.", 2),
    ],
  },
  reforma_sistemas: {
    label: "ERP e tecnologia",
    perguntas: [
      q("rf_sis_01", "Atualização do ERP", "O ERP ou sistema de emissão fiscal já tem previsão de atualização para IBS e CBS?", "Sistema sem condição de emitir documentos da Reforma."),
      q("rf_sis_02", "Responsável", "Há responsável interno ou fornecedor do sistema acompanhando a adequação à Reforma?", "Adequação sem dono.", 2),
      q("rf_sis_03", "Integração", "Os sistemas de vendas, estoque, financeiro e fiscal estão integrados o suficiente para evitar retrabalho na adequação?", "Retrabalho e custo na adequação.", 2),
    ],
  },
  reforma_contratos: {
    label: "Contratos e cláusulas tributárias",
    perguntas: [
      q("rf_con_01", "Contratos longos", "Os contratos de longo prazo com clientes foram revisados em relação ao reajuste por mudança de tributos?", "Contrato sem repasse trava a margem."),
      q("rf_con_02", "Fornecedores e locações", "Os contratos com fornecedores e de locação possuem cláusula sobre repasse de tributos?", "Custo tributário assumido sem previsão.", 2),
      q("rf_con_03", "Proposta comercial", "A política comercial prevê a forma de apresentar o novo tributo na proposta e no preço ao cliente?", "Proposta fora do novo padrão.", 2),
    ],
  },
  reforma_regime: {
    label: "Regime tributário e planejamento",
    perguntas: [
      q("rf_reg_01", "Revisão do regime", "O regime tributário atual foi revisado nos últimos 12 meses com base em números reais?", "Regime possivelmente inadequado."),
      q("rf_reg_02", "Efeito no regime", "A empresa avaliou o efeito da Reforma sobre o regime atual (Simples, Presumido ou Real)?", "Regime vigente pode deixar de ser vantajoso."),
      q("rf_reg_03", "Alternativas", "Foi comparado o regime atual com alternativas, considerando os créditos de IBS e CBS que a empresa poderia aproveitar?", "Oportunidade de enquadramento melhor não avaliada."),
      q("rf_reg_04", "Benefícios", "A empresa conhece benefício fiscal, regime especial ou redução de alíquota que possa mudar com a Reforma?", "Perda de benefício sem planejamento.", 2),
    ],
  },
  reforma_transicao: {
    label: "Transição e preparação",
    perguntas: [
      q("rf_tra_01", "Plano", "Existe um plano com prazos para a adequação à Reforma Tributária entre 2026 e 2033?", "Adequação sem cronograma."),
      q("rf_tra_02", "Responsável", "Há um responsável definido por acompanhar as mudanças da Reforma na empresa?", "Mudanças perdidas por falta de dono."),
      q("rf_tra_03", "Acompanhamento", "A direção recebe informações periódicas sobre o andamento da adequação?", "Decisão tardia.", 2),
      q("rf_tra_04", "Recursos", "Foram previstos tempo e orçamento para ajustes de sistema, processos e treinamento?", "Adequação sem recursos.", 2),
    ],
  },
};

// Temas da tela inicial -> eixos que ganham aprofundamento.
const EIXOS_POR_TEMA_REFORMA = [
  ["entender como ibs e cbs", ["reforma_transicao", "reforma_carga"]],
  ["carga tributaria pode aumentar", ["reforma_carga"]],
  ["comparar a tributacao atual", ["reforma_carga", "reforma_regime"]],
  ["creditos de ibs/cbs", ["reforma_creditos", "reforma_fornecedores"]],
  ["preco de venda e margem", ["reforma_precos"]],
  ["fornecedores e clientes", ["reforma_fornecedores", "reforma_clientes"]],
  ["notas fiscais, erp", ["reforma_fiscal", "reforma_sistemas"]],
  ["contratos e repasse", ["reforma_contratos", "reforma_precos"]],
  ["simples nacional", ["reforma_regime", "reforma_creditos"]],
  ["lucro presumido x lucro real", ["reforma_regime", "reforma_carga"]],
  ["holding, imoveis ou locacoes", ["reforma_contratos", "reforma_regime"]],
  ["2027 em diante", ["reforma_transicao"]],
];

// Dores (passo "dor") -> eixos.
const EIXOS_POR_DOR_REFORMA = [
  ["alterar minha carga", ["reforma_carga"]],
  ["quais compras e despesas", ["reforma_creditos"]],
  ["perder margem", ["reforma_precos"]],
  ["revisei precos e contratos", ["reforma_precos", "reforma_contratos"]],
  ["erp", ["reforma_sistemas", "reforma_fiscal"]],
  ["meus clientes", ["reforma_clientes"]],
  ["meus fornecedores", ["reforma_fornecedores"]],
  ["simples nacional", ["reforma_regime"]],
  ["lucro presumido x lucro real", ["reforma_regime"]],
  ["beneficios ou tratamentos", ["reforma_regime"]],
  ["interestaduais, importacao", ["reforma_fiscal"]],
  ["plano de adequacao", ["reforma_transicao"]],
];

function semAcento(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function eixosPorTexto(lista, tabela) {
  const eixos = [];
  for (const item of Array.isArray(lista) ? lista : []) {
    const chave = semAcento(typeof item === "string" ? item : item?.label || item?.id);
    for (const [trecho, ids] of tabela) {
      if (chave.includes(trecho)) {
        for (const id of ids) if (!eixos.includes(id)) eixos.push(id);
      }
    }
  }
  return eixos;
}

// Eixos que devem ser aprofundados no diagnóstico da Reforma: temas escolhidos,
// dores marcadas e sinais das respostas de triagem. Limite de 4 eixos
// (o questionário fica curto); se houver menos de 3, completa com a base.
export function eixosPrioritariosReforma({ objetivos = [], dores = [], perfil = {}, limite = 4 } = {}) {
  const eixos = [
    ...eixosPorTexto(objetivos, EIXOS_POR_TEMA_REFORMA),
    ...eixosPorTexto(dores, EIXOS_POR_DOR_REFORMA),
  ];

  const sinais = [
    [["NAO_INICIADO", "ANDAMENTO"].includes(perfil?.erp), "reforma_sistemas"],
    [["BAIXA", "NAO_SEI"].includes(perfil?.repassePreco), "reforma_precos"],
    [perfil?.comprasCredito === "ALTO", "reforma_creditos"],
    [["NAO", "PARCIAL"].includes(perfil?.contratos), "reforma_contratos"],
    [["SIM", "ANALISAR"].includes(perfil?.beneficios), "reforma_regime"],
    [["NAO_INICIOU", "ENTENDENDO"].includes(perfil?.preparacao), "reforma_transicao"],
    [["B2B", "MISTO"].includes(perfil?.perfilClientes), "reforma_clientes"],
    [(perfil?.operacoes || []).some((x) => /importa|exporta|interestadual|v[aá]rios munic/i.test(String(x))), "reforma_fiscal"],
  ];
  for (const [ativo, id] of sinais) if (ativo && !eixos.includes(id)) eixos.push(id);

  const escolhidos = eixos.slice(0, limite);
  for (const base of ["reforma_carga", "reforma_creditos", "reforma_transicao"]) {
    if (escolhidos.length >= 3) break;
    if (!escolhidos.includes(base)) escolhidos.push(base);
  }
  return escolhidos;
}

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
