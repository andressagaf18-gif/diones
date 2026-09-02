// DESTINO REAL: /src/tributario/planejamento-engine.js
// Planejamento Tributário V3 — motor determinístico incremental.
// NÃO trata IBS/CBS/transição.
//
// Fontes jurídicas de referência do motor:
// - IRPJ: Lei 9.249/1995 + Receita Federal (15% e adicional de 10%).
// - CSLL: Lei 7.689/1988 + Receita Federal (9% PJ em geral).
// - Lucro Presumido: presunções segregadas por natureza da receita.
// - Simples Nacional: Resolução CGSN 140/2018, Anexos I a V.
//
// IMPORTANTE:
// O motor calcula. IA/documentos qualificam a operação e as premissas.
// Benefício fiscal, crédito e enquadramento especial exigem validação jurídica/documental.

export const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const ROTULOS = {jan:"Jan",fev:"Fev",mar:"Mar",abr:"Abr",mai:"Mai",jun:"Jun",jul:"Jul",ago:"Ago",set:"Set",out:"Out",nov:"Nov",dez:"Dez"};

export const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  const n = Number(
    s.includes(",")
      ? s.replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"")
      : s.replace(/[^\d.-]/g,"")
  );
  return Number.isFinite(n) ? n : 0;
};

export const moeda = (v) => num(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const pct = (v) => `${num(v).toFixed(2).replace(".",",")}%`;
export const mapaMes = () => Object.fromEntries(MESES.map(m => [m,0]));

const TABELAS_SIMPLES = {
  I: [
    [180000,4,0],
    [360000,7.3,5940],
    [720000,9.5,13860],
    [1800000,10.7,22500],
    [3600000,14.3,87300],
    [4800000,19,378000],
  ],
  II: [
    [180000,4.5,0],
    [360000,7.8,5940],
    [720000,10,13860],
    [1800000,11.2,22500],
    [3600000,14.7,85500],
    [4800000,30,720000],
  ],
  III: [
    [180000,6,0],
    [360000,11.2,9360],
    [720000,13.5,17640],
    [1800000,16,35640],
    [3600000,21,125640],
    [4800000,33,648000],
  ],
  IV: [
    [180000,4.5,0],
    [360000,9,8100],
    [720000,10.2,12420],
    [1800000,14,39780],
    [3600000,22,183780],
    [4800000,33,828000],
  ],
  V: [
    [180000,15.5,0],
    [360000,18,4500],
    [720000,19.5,9900],
    [1800000,20.5,17100],
    [3600000,23,62100],
    [4800000,30.5,540000],
  ],
};

function normalizarAnexo(v=""){
  const s=String(v||"").toUpperCase().replace(/ANEXO/g,"").replace(/[^IVX]/g,"").trim();
  return ["I","II","III","IV","V"].includes(s)?s:"";
}

function aliquotaEfetivaSimples(rbt12,anexo){
  const r=num(rbt12);
  const a=normalizarAnexo(anexo);
  const tabela=TABELAS_SIMPLES[a];
  if(!tabela||r<=0||r>4800000)return null;
  const faixa=tabela.find(([limite])=>r<=limite)||tabela.at(-1);
  const [,aliquotaNominal,parcelaDeduzir]=faixa;
  const efetiva=((r*aliquotaNominal/100)-parcelaDeduzir)/r*100;
  return {
    anexo:a,
    rbt12:r,
    aliquotaNominal,
    parcelaDeduzir,
    aliquotaEfetiva:Math.max(0,efetiva),
  };
}

export function baseVazia() {
  return {
    faturamento:{industria:mapaMes(),comercio:mapaMes(),servicos:mapaMes()},
    tributos:{pis:mapaMes(),cofins:mapaMes(),icms:mapaMes(),ipi:mapaMes(),iss:mapaMes()},
    custos:{
      industria:{estoqueInicial:mapaMes(),insumos:mapaMes(),maoObraDireta:mapaMes(),ggf:mapaMes(),estoqueFinal:mapaMes()},
      comercio:{estoqueInicial:mapaMes(),compras:mapaMes(),estoqueFinal:mapaMes()},
      servicos:{servicosInicial:mapaMes(),maoObraDireta:mapaMes(),gastosDiretos:mapaMes(),gastosIndiretos:mapaMes(),servicosFinal:mapaMes()},
    },
    despesas:{operacionais:mapaMes(),comerciais:mapaMes(),administrativas:mapaMes(),tributarias:mapaMes(),diretoria:mapaMes(),logistica:mapaMes(),ocupacao:mapaMes(),outras:mapaMes()},
    folha:{folha13:mapaMes(),proLabore:mapaMes(),inssFgts:mapaMes(),outros:mapaMes(),encargosPatronais:mapaMes()},
    creditos:{pis:mapaMes(),cofins:mapaMes(),icms:mapaMes(),ipi:mapaMes()},
    ajustesLucroReal:{adicoes:mapaMes(),exclusoes:mapaMes(),compensacoes:mapaMes()},
    parametros:{
      anoBase:new Date().getFullYear(),
      regimeAtual:"",
      simplesAliquotaEfetiva:0,
      simplesDas:mapaMes(),
      simplesComposicaoDas:{
        irpj:mapaMes(),csll:mapaMes(),cofins:mapaMes(),pis:mapaMes(),
        cpp:mapaMes(),icms:mapaMes(),ipi:mapaMes(),iss:mapaMes()
      },
      simplesRbt12Base:0,
      simplesAnexos:{
        comercio:"I",
        industria:"II",
        servicos:"",
      },
      presumido:{
        pis:0.65,
        cofins:3,
        irpj:15,
        adicionalIrpj:10,
        limiteAdicionalMensal:20000,
        csll:9,
        presuncoesPorNatureza:{
          industria:{irpj:8,csll:12},
          comercio:{irpj:8,csll:12},
          servicos:{irpj:32,csll:32},
        },
        // Compatibilidade com versões anteriores.
        presuncaoIrpj:32,
        presuncaoCsll:32,
      },
      real:{pis:1.65,cofins:7.6,irpj:15,adicionalIrpj:10,limiteAdicionalMensal:20000,csll:9}
    },
    fontes:[],
    divergencias:[],
    dadosFaltantes:[]
  };
}

const somaMapa = (m={}) => MESES.reduce((a,x)=>a+num(m?.[x]),0);
const somaMes = (...mapas) => Object.fromEntries(MESES.map(m=>[m,mapas.reduce((a,x)=>a+num(x?.[m]),0)]));
const somaGrupo = (obj={}) => Object.values(obj||{}).reduce((acc,m)=>somaMes(acc,m),mapaMes());

function garantirBase(base={}){
  const padrao=baseVazia();
  const merge=(d,s)=>{
    if(!s||typeof s!=="object")return d;
    Object.entries(s).forEach(([k,v])=>{
      if(v&&typeof v==="object"&&!Array.isArray(v)&&d[k]&&typeof d[k]==="object"&&!Array.isArray(d[k])){
        merge(d[k],v);
      }else if(v!==undefined){
        d[k]=v;
      }
    });
    return d;
  };
  return merge(padrao,base||{});
}

export function operacional(baseOriginal){
  const base=garantirBase(baseOriginal);
  const receita=somaMes(base.faturamento.industria,base.faturamento.comercio,base.faturamento.servicos);
  const cpv=Object.fromEntries(MESES.map(m=>[m,
    num(base.custos.industria.estoqueInicial[m])
    +num(base.custos.industria.insumos[m])
    +num(base.custos.industria.maoObraDireta[m])
    +num(base.custos.industria.ggf[m])
    -num(base.custos.industria.estoqueFinal[m])
  ]));
  const cmv=Object.fromEntries(MESES.map(m=>[m,
    num(base.custos.comercio.estoqueInicial[m])
    +num(base.custos.comercio.compras[m])
    -num(base.custos.comercio.estoqueFinal[m])
  ]));
  const csp=Object.fromEntries(MESES.map(m=>[m,
    num(base.custos.servicos.servicosInicial[m])
    +num(base.custos.servicos.maoObraDireta[m])
    +num(base.custos.servicos.gastosDiretos[m])
    +num(base.custos.servicos.gastosIndiretos[m])
    -num(base.custos.servicos.servicosFinal[m])
  ]));
  const custos=somaMes(cpv,cmv,csp);
  const despesas=somaGrupo(base.despesas);
  const massa=somaMes(base.folha.folha13,base.folha.proLabore,base.folha.inssFgts,base.folha.outros);
  return {
    receita,cpv,cmv,csp,custos,despesas,massa,
    receitaPorNatureza:{
      industria:base.faturamento.industria,
      comercio:base.faturamento.comercio,
      servicos:base.faturamento.servicos,
    },
    totalReceita:somaMapa(receita),
    totalReceitaIndustria:somaMapa(base.faturamento.industria),
    totalReceitaComercio:somaMapa(base.faturamento.comercio),
    totalReceitaServicos:somaMapa(base.faturamento.servicos),
    totalCustos:somaMapa(custos),
    totalDespesas:somaMapa(despesas),
    totalMassa:somaMapa(massa)
  };
}

export function fatorR(base){
  const o=operacional(base);
  const fator=o.totalReceita>0?o.totalMassa/o.totalReceita:0;
  return {rbt12:o.totalReceita,massa:o.totalMassa,fator,percentual:fator*100,atinge28:fator>=0.28};
}

function adicional(base,taxa,limite){ return Math.max(0,num(base)-num(limite))*(num(taxa)/100); }

export function simples(baseOriginal){
  const base=garantirBase(baseOriginal);
  const o=operacional(base);
  const p=base.parametros||{};
  const crescimento=num(p.crescimentoCenario);
  const dasInformado=somaMapa(p.simplesDas);
  const aliquotaInformada=num(p.simplesAliquotaEfetiva);
  const aliquotaObservada=o.totalReceita>0&&dasInformado>0?(dasInformado/o.totalReceita)*100:0;

  const rbt12Documental=num(p.simplesRbt12Base);
  const mesesComReceita=MESES.filter(m=>num(o.receita[m])>0).length;

  // Se o próprio planejamento contém uma série anual suficientemente preenchida,
  // a receita anual projetada é a melhor aproximação do RBT12 do cenário.
  // Se existe apenas um período pontual, preservamos o RBT12 documental.
  const rbt12Referencia=
    mesesComReceita>=6 && o.totalReceita>0
      ?o.totalReceita
      :rbt12Documental>0
      ?rbt12Documental*(1+crescimento/100)
      :o.totalReceita;

  const anexos=p.simplesAnexos||{};
  const naturezas=[
    ["industria","II"],
    ["comercio","I"],
    ["servicos",""],
  ];

  const detalhes=[];
  let total=0;
  let receitaComTabela=0;
  let receitaSemTabela=0;

  naturezas.forEach(([natureza,padrao])=>{
    const receita=somaMapa(base.faturamento[natureza]);
    if(receita<=0)return;

    let anexo=normalizarAnexo(anexos[natureza]||padrao);

    // Serviço: não assumimos Anexo III/V sem classificação confirmada.
    if(natureza==="servicos"&&!normalizarAnexo(anexos[natureza]))anexo="";

    const faixa=anexo?aliquotaEfetivaSimples(rbt12Referencia,anexo):null;

    if(faixa){
      const imposto=receita*faixa.aliquotaEfetiva/100;
      total+=imposto;
      receitaComTabela+=receita;
      detalhes.push({natureza,receita,anexo,...faixa,imposto,origem:"TABELA_CGSN"});
    }else{
      receitaSemTabela+=receita;
      detalhes.push({natureza,receita,anexo:"",imposto:null,origem:"PENDENTE_ANEXO"});
    }
  });

  // Fallback histórico apenas quando não é possível reconstruir pela tabela.
  const aliquotaFallback=aliquotaInformada>0?aliquotaInformada:aliquotaObservada;
  if(receitaSemTabela>0&&aliquotaFallback>0){
    const imposto=receitaSemTabela*aliquotaFallback/100;
    total+=imposto;
    detalhes.forEach(d=>{
      if(d.imposto===null){
        d.imposto=d.receita*aliquotaFallback/100;
        d.aliquotaEfetiva=aliquotaFallback;
        d.origem=aliquotaInformada>0?"ALIQUOTA_INFORMADA":"ALIQUOTA_OBSERVADA_PELO_DAS";
      }
    });
    receitaComTabela+=receitaSemTabela;
    receitaSemTabela=0;
  }

  // Na competência histórica, o DAS efetivamente apurado no PGDAS prevalece
  // sobre a recomposição teórica, pois pode conter redução de ICMS/ISS,
  // segregações, imunidades ou particularidades comprovadas no documento.
  // Em cenários de crescimento, o motor volta a recalcular pelas tabelas.
  if(dasInformado>0&&crescimento===0){
    total=dasInformado;
  }

  const completo=o.totalReceita>0&&receitaSemTabela===0&&rbt12Referencia>0;
  const mensal=Object.fromEntries(MESES.map(m=>{
    const recMes=num(o.receita[m]);
    const proporcao=o.totalReceita>0?recMes/o.totalReceita:0;
    return [m,total*proporcao];
  }));

  // A composição informada pelo PGDAS é a fonte prioritária para demonstrar
  // quanto de cada tributo está contido no DAS. Ela é informativa: os valores
  // não podem ser somados novamente ao total do Simples.
  const composicaoFonte=p.simplesComposicaoDas||{};
  const composicaoObservada={
    irpj:somaMapa(composicaoFonte.irpj),
    csll:somaMapa(composicaoFonte.csll),
    cofins:somaMapa(composicaoFonte.cofins),
    pis:somaMapa(composicaoFonte.pis),
    cpp:somaMapa(composicaoFonte.cpp),
    icms:somaMapa(composicaoFonte.icms),
    ipi:somaMapa(composicaoFonte.ipi),
    iss:somaMapa(composicaoFonte.iss),
  };
  const totalComposicao=Object.values(composicaoObservada).reduce((a,v)=>a+num(v),0);
  const composicaoDas=Object.fromEntries(
    Object.entries(composicaoObservada).map(([tributo,valor])=>[
      tributo,
      totalComposicao>0?total*(num(valor)/totalComposicao):null
    ])
  );

  return {
    regime:"SIMPLES_NACIONAL",
    mensal,
    total,
    carga:o.totalReceita?total/o.totalReceita*100:0,
    completo,
    aliquotaEfetivaUsada:o.totalReceita?total/o.totalReceita*100:0,
    origemAliquota:dasInformado>0&&crescimento===0?"DAS_PGDAS_COMPROVADO":detalhes.some(d=>d.origem==="TABELA_CGSN")?"TABELAS_CGSN_SEGREGADAS":aliquotaInformada>0?"ALIQUOTA_INFORMADA":"SEM_BASE",
    rbt12Referencia,
    detalhes,
    tributos:{das:total,...composicaoDas},
    composicaoDas,
    origemComposicao:totalComposicao>0?"PGDAS_PROPORCIONAL":"NAO_INFORMADA",
    composicaoCompleta:totalComposicao>0,
    pendencias:detalhes.filter(d=>d.origem==="PENDENTE_ANEXO").map(d=>`Confirmar Anexo do Simples para receita de ${d.natureza}.`)
  };
}

function presuncaoNatureza(p,natureza,tipo){
  const v=p?.presuncoesPorNatureza?.[natureza]?.[tipo];
  if(num(v)>0)return num(v);
  // Compatibilidade: só utiliza o parâmetro legado quando não existe matriz por natureza.
  if(!p?.presuncoesPorNatureza){
    return tipo==="irpj"?num(p?.presuncaoIrpj):num(p?.presuncaoCsll);
  }
  return natureza==="servicos"?32:(tipo==="irpj"?8:12);
}

export function presumido(baseOriginal){
  const base=garantirBase(baseOriginal);
  const o=operacional(base);
  const p=base.parametros.presumido||{};
  const mensal=MESES.map(m=>{
    const ri=num(base.faturamento.industria[m]);
    const rc=num(base.faturamento.comercio[m]);
    const rs=num(base.faturamento.servicos[m]);
    const r=ri+rc+rs;

    const bir=
      ri*presuncaoNatureza(p,"industria","irpj")/100+
      rc*presuncaoNatureza(p,"comercio","irpj")/100+
      rs*presuncaoNatureza(p,"servicos","irpj")/100;

    const bcs=
      ri*presuncaoNatureza(p,"industria","csll")/100+
      rc*presuncaoNatureza(p,"comercio","csll")/100+
      rs*presuncaoNatureza(p,"servicos","csll")/100;

    const pis=r*num(p.pis)/100;
    const cof=r*num(p.cofins)/100;
    const ir=bir*num(p.irpj)/100;
    const cs=bcs*num(p.csll)/100;
    const iss=num(base.tributos.iss[m]);
    const icms=num(base.tributos.icms[m]);
    const ipi=num(base.tributos.ipi[m]);
    const enc=num(base.folha.encargosPatronais[m]);

    return {
      mes:m,receita:r,baseIrpj:bir,baseCsll:bcs,pis,cofins:cof,irpj:ir,
      adicionalIrpj:0,csll:cs,iss,icms,ipi,encargos:enc,
      total:pis+cof+ir+cs+iss+icms+ipi+enc
    };
  });

  // Adicional de IRPJ no Presumido deve respeitar o período de apuração.
  // O motor usa trimestre: R$ 20 mil x 3 = R$ 60 mil.
  for(let q=0;q<4;q++){
    const grupo=mensal.slice(q*3,q*3+3);
    const baseTri=grupo.reduce((a,x)=>a+num(x.baseIrpj),0);
    const adicionalTri=adicional(baseTri,p.adicionalIrpj,num(p.limiteAdicionalMensal)*3);
    if(adicionalTri>0&&baseTri>0){
      grupo.forEach(x=>{
        const parte=adicionalTri*(num(x.baseIrpj)/baseTri);
        x.adicionalIrpj=parte;
        x.total+=parte;
      });
    }
  }

  const total=mensal.reduce((a,x)=>a+x.total,0);
  const tributos={
    pis:mensal.reduce((a,x)=>a+x.pis,0),
    cofins:mensal.reduce((a,x)=>a+x.cofins,0),
    icms:mensal.reduce((a,x)=>a+x.icms,0),
    ipi:mensal.reduce((a,x)=>a+x.ipi,0),
    iss:mensal.reduce((a,x)=>a+x.iss,0),
    cpp:mensal.reduce((a,x)=>a+x.encargos,0),
    irpj:mensal.reduce((a,x)=>a+x.irpj,0),
    adicionalIrpj:mensal.reduce((a,x)=>a+x.adicionalIrpj,0),
    csll:mensal.reduce((a,x)=>a+x.csll,0),
  };
  return {
    regime:"LUCRO_PRESUMIDO",
    mensal,total,
    tributos,
    baseIrpj:mensal.reduce((a,x)=>a+x.baseIrpj,0),
    baseCsll:mensal.reduce((a,x)=>a+x.baseCsll,0),
    carga:o.totalReceita?total/o.totalReceita*100:0,
    completo:o.totalReceita>0,
    presuncoesUsadas:{
      industria:{irpj:presuncaoNatureza(p,"industria","irpj"),csll:presuncaoNatureza(p,"industria","csll")},
      comercio:{irpj:presuncaoNatureza(p,"comercio","irpj"),csll:presuncaoNatureza(p,"comercio","csll")},
      servicos:{irpj:presuncaoNatureza(p,"servicos","irpj"),csll:presuncaoNatureza(p,"servicos","csll")},
    }
  };
}

export function real(baseOriginal){
  const base=garantirBase(baseOriginal);
  const o=operacional(base);
  const p=base.parametros.real||{};
  const ajustes=base.ajustesLucroReal||{adicoes:mapaMes(),exclusoes:mapaMes(),compensacoes:mapaMes()};

  const mensal=MESES.map(m=>{
    const r=num(o.receita[m]);
    const pis=Math.max(0,r*num(p.pis)/100-num(base.creditos.pis[m]));
    const cof=Math.max(0,r*num(p.cofins)/100-num(base.creditos.cofins[m]));
    const iss=num(base.tributos.iss[m]);
    const icms=Math.max(0,num(base.tributos.icms[m])-num(base.creditos.icms[m]));
    const ipi=Math.max(0,num(base.tributos.ipi[m])-num(base.creditos.ipi[m]));
    const enc=num(base.folha.encargosPatronais[m]);
    const cust=num(o.custos[m]);
    const desp=num(o.despesas[m]);

    // Proxy gerencial de lucro contábil antes de IRPJ/CSLL.
    // Para conclusão legal, ECF/LALUR/LACS e ajustes fiscais devem ser validados.
    const lucroContabilAntesIrCs=r-cust-desp-pis-cof-iss-icms-ipi-enc;
    const lucroFiscalAntesComp=
      lucroContabilAntesIrCs
      +num(ajustes.adicoes?.[m])
      -num(ajustes.exclusoes?.[m]);

    const lucroRealBase=Math.max(
      0,
      lucroFiscalAntesComp-num(ajustes.compensacoes?.[m])
    );

    const ir=lucroRealBase*num(p.irpj)/100;
    const ad=adicional(lucroRealBase,p.adicionalIrpj,p.limiteAdicionalMensal);
    const cs=lucroRealBase*num(p.csll)/100;

    return {
      mes:m,receita:r,pis,cofins:cof,iss,icms,ipi,encargos:enc,
      custos:cust,despesas:desp,
      lucroContabilAntesIrCs,
      lucroFiscalAntesComp,
      lucroRealBase,
      irpj:ir,adicionalIrpj:ad,csll:cs,
      total:pis+cof+iss+icms+ipi+enc+ir+ad+cs
    };
  });

  const total=mensal.reduce((a,x)=>a+x.total,0);
  const tributos={
    pis:mensal.reduce((a,x)=>a+x.pis,0),
    cofins:mensal.reduce((a,x)=>a+x.cofins,0),
    icms:mensal.reduce((a,x)=>a+x.icms,0),
    ipi:mensal.reduce((a,x)=>a+x.ipi,0),
    iss:mensal.reduce((a,x)=>a+x.iss,0),
    cpp:mensal.reduce((a,x)=>a+x.encargos,0),
    irpj:mensal.reduce((a,x)=>a+x.irpj,0),
    adicionalIrpj:mensal.reduce((a,x)=>a+x.adicionalIrpj,0),
    csll:mensal.reduce((a,x)=>a+x.csll,0),
  };
  const baseLucroReal=mensal.reduce((a,x)=>a+x.lucroRealBase,0);
  const dadosOperacionaisSuficientes=
    o.totalReceita>0 &&
    (
      o.totalCustos>0 ||
      o.totalDespesas>0 ||
      base.fontes?.some?.(f=>/dre|balancete|raz[aã]o|cust|despes/i.test(`${f?.campo||""} ${f?.documento||""}`))
    );

  return {
    regime:"LUCRO_REAL",
    mensal,total,tributos,
    carga:o.totalReceita?total/o.totalReceita*100:0,
    completo:o.totalReceita>0&&dadosOperacionaisSuficientes,
    baseLucroReal,
    lucroContabilAntesIrCs:mensal.reduce((a,x)=>a+x.lucroContabilAntesIrCs,0),
    observacaoBase:"IRPJ/CSLL calculados sobre lucro fiscal estimado antes de IRPJ/CSLL, ajustável por adições, exclusões e compensações."
  };
}

export function comparar(baseOriginal){
  const base=garantirBase(baseOriginal);
  const s=simples(base),p=presumido(base),r=real(base),fr=fatorR(base),o=operacional(base);
  const validos=[s.completo?s:null,p.completo?p:null,r.completo?r:null].filter(Boolean).sort((a,b)=>a.total-b.total);
  const melhor=validos[0]||null;
  const mapa={SIMPLES:s,SIMPLES_NACIONAL:s,PRESUMIDO:p,LUCRO_PRESUMIDO:p,REAL:r,LUCRO_REAL:r};
  const atual=mapa[String(base.parametros.regimeAtual||"").toUpperCase()]||null;
  const economia=atual&&melhor?Math.max(0,atual.total-melhor.total):0;

  const dre=(reg)=>{
    const t=reg.tributos||{};
    const irCs=num(t.irpj)+num(t.adicionalIrpj)+num(t.csll);
    const tributosSobreReceita=
      reg.regime==="SIMPLES_NACIONAL"
        ?reg.total
        :num(t.pis)+num(t.cofins)+num(t.icms)+num(t.ipi)+num(t.iss);
    const encargosFolha=num(t.cpp);
    const lucroAntesIrCs=
      o.totalReceita-tributosSobreReceita-encargosFolha-o.totalCustos-o.totalDespesas;
    return {
    receitaBruta:o.totalReceita,
    tributos:reg.total,
    tributosSobreReceita,
    encargosFolha,
    detalhamentoTributos:t,
    baseIrpj:reg.regime==="LUCRO_REAL"?num(reg.baseLucroReal):num(reg.baseIrpj),
    baseCsll:reg.regime==="LUCRO_REAL"?num(reg.baseLucroReal):num(reg.baseCsll),
    receitaLiquida:o.totalReceita-tributosSobreReceita,
    cpv:somaMapa(o.cpv),
    cmv:somaMapa(o.cmv),
    csp:somaMapa(o.csp),
    despesas:o.totalDespesas,
    lucroAntesIrCs:
      reg.regime==="SIMPLES_NACIONAL"
        ?lucroAntesIrCs
        :reg.regime==="LUCRO_REAL"
        ?num(reg.lucroContabilAntesIrCs)
        :lucroAntesIrCs,
    irpjCsll:reg.regime==="SIMPLES_NACIONAL"?0:irCs,
    lucroLiquido:o.totalReceita-reg.total-o.totalCustos-o.totalDespesas,
    composicaoInformativa:reg.regime==="SIMPLES_NACIONAL",
  }};

  return {
    simples:s,presumido:p,real:r,fatorR:fr,melhor,regimeAtual:atual,
    economia,economiaPct:atual?.total?economia/atual.total*100:0,
    dre:{simples:dre(s),presumido:dre(p),real:dre(r)}
  };
}

export function cenario(baseOriginal,crescimento=0){
  const c=garantirBase(JSON.parse(JSON.stringify(baseOriginal||{})));
  const f=1+num(crescimento)/100;

  ["industria","comercio","servicos"].forEach(
    g=>MESES.forEach(m=>{
      c.faturamento[g][m]=num(c.faturamento[g][m])*f;
    })
  );

  // Custos e despesas variáveis não são automaticamente escalados:
  // crescer faturamento não significa que todo custo cresce linearmente.
  // O consultor pode editar o cenário depois.
  c.parametros={
    ...(c.parametros||{}),
    crescimentoCenario:num(crescimento),
  };

  return c;
}
