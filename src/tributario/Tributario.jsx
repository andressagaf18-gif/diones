import ReformaSimulador from "./ReformaSimulador";
import PlanejamentoTributario from "./PlanejamentoTributario";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

const NAVY = "#17233D";
const CORAL = "#FF6B4A";
const MUTED = "#5B667A";
const WHITE = "#FFFFFF";
const BG = "#F6F8FC";
const BORDER = "#E3E7EF";

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DISPLAY_FONT =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif";

function Card({
  children,
  style = {},
}) {
  return (
    <div
      style={{
        background: WHITE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 18,
        boxShadow:
          "0 8px 24px rgba(15,31,56,.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Botao({
  children,
  onClick,
  secundario = false,
  disabled = false,
  style = {},
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border:
          secundario
            ? "1px solid #D8DEEA"
            : 0,
        background:
          secundario
            ? WHITE
            : CORAL,
        color:
          secundario
            ? NAVY
            : WHITE,
        borderRadius: 11,
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 12,
        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
        opacity:
          disabled
            ? .55
            : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function inputStyle() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #D8DEEA",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 12,
    color: NAVY,
    background: WHITE,
    outline: "none",
  };
}

function somenteDigitos(valor = "") {
  return String(valor).replace(
    /\D/g,
    ""
  );
}

function formatarCnpj(valor = "") {
  const digits =
    somenteDigitos(valor);

  if (
    digits.length !== 14
  ) {
    return valor;
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

function novaEmpresa() {
  return {
    id:
      crypto?.randomUUID?.() ||
      `${Date.now()}_${Math.random()}`,
    cnpj: "",
    carregando: false,
    erro: "",
    dados: null,
  };
}

function ModalidadeCard({
  ativa,
  titulo,
  descricao,
  onClick,
  destaque = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        width: "100%",
        minHeight: 138,
        borderRadius: 16,
        padding: 16,
        cursor: "pointer",
        border:
          ativa
            ? `2px solid ${CORAL}`
            : "1px solid #D8DEEA",
        background:
          ativa
            ? "#FFF7F3"
            : WHITE,
        color: NAVY,
        boxShadow:
          destaque
            ? "0 10px 28px rgba(255,107,74,.08)"
            : "none",
      }}
    >
      {destaque && (
        <span
          style={{
            display: "inline-block",
            background: CORAL,
            color: WHITE,
            borderRadius: 999,
            padding: "4px 7px",
            fontSize: 8,
            fontWeight: 900,
            marginBottom: 8,
          }}
        >
          RECOMENDADO
        </span>
      )}

      <strong
        style={{
          display: "block",
          fontSize: 15,
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          display: "block",
          marginTop: 6,
          color: MUTED,
          fontSize: 10.5,
          lineHeight: 1.5,
        }}
      >
        {descricao}
      </span>
    </button>
  );
}

function EmpresaCard({
  empresa,
  index,
  onChangeCnpj,
  onBuscar,
  onRemover,
  podeRemover,
}) {
  return (
    <Card
      style={{
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <strong>
          Empresa {index + 1}
        </strong>

        {podeRemover && (
          <button
            type="button"
            onClick={onRemover}
            style={{
              border: 0,
              background:
                "transparent",
              color: "#A12B2B",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            Remover
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(220px,1fr) auto",
          gap: 8,
        }}
      >
        <input
          value={empresa.cnpj}
          onChange={(e) =>
            onChangeCnpj(
              e.target.value
            )
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter"
            ) {
              onBuscar();
            }
          }}
          placeholder="00.000.000/0000-00"
          style={inputStyle()}
        />

        <Botao
          onClick={onBuscar}
          disabled={
            empresa.carregando
          }
        >
          {empresa.carregando
            ? "Buscando..."
            : "Buscar CNPJ"}
        </Botao>
      </div>

      {empresa.erro && (
        <div
          style={{
            marginTop: 8,
            color: "#993C1D",
            background:
              "#FAECE7",
            padding: 8,
            borderRadius: 8,
            fontSize: 10,
          }}
        >
          {empresa.erro}
        </div>
      )}

      {empresa.dados && (
        <div
          style={{
            marginTop: 10,
            background:
              "#F7F8FB",
            borderRadius: 10,
            padding: 11,
            display: "grid",
            gap: 5,
          }}
        >
          <strong
            style={{
              fontSize: 12,
            }}
          >
            {empresa.dados.razaoSocial ||
              empresa.dados.razao_social ||
              empresa.dados.nome ||
              "Empresa localizada"}
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
            }}
          >
            CNPJ:{" "}
            {formatarCnpj(
              empresa.dados.cnpj ||
              empresa.cnpj
            )}
          </div>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
            }}
          >
            CNAE principal:{" "}
            {empresa.dados.cnaePrincipal?.descricao ||
              empresa.dados.cnae_principal?.descricao ||
              empresa.dados.cnaeFiscalDescricao ||
              empresa.dados.atividadePrincipal ||
              "-"}
          </div>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
            }}
          >
            Município/UF:{" "}
            {[
              empresa.dados.municipio,
              empresa.dados.uf,
            ]
              .filter(Boolean)
              .join(" / ") ||
              "-"}
          </div>
        </div>
      )}
    </Card>
  );
}

function UploadDocumentos({
  arquivos,
  setArquivos,
}) {
  function adicionarArquivos(
    lista
  ) {
    const novos =
      Array.from(
        lista || []
      );

    if (!novos.length) {
      return;
    }

    setArquivos(
      (atuais) => [
        ...atuais,
        ...novos,
      ]
    );
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 12,
          alignItems:
            "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <strong
            style={{
              fontSize: 14,
            }}
          >
            Documentos
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            DRE, balancetes, PGDAS-D, ECF, ECD, SPED, XML, notas fiscais, folha, planilhas e demais arquivos tributários.
          </div>
        </div>

        <span
          style={{
            background:
              "#EEF3FF",
            color: "#31589C",
            borderRadius: 999,
            padding: "5px 8px",
            fontSize: 9,
            fontWeight: 900,
          }}
        >
          {arquivos.length} arquivo(s)
        </span>
      </div>

      <label
        style={{
          minHeight: 110,
          border:
            "2px dashed #C9D1DF",
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 18,
          cursor: "pointer",
          background:
            "#FBFCFE",
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              fontSize: 12,
            }}
          >
            Clique para selecionar arquivos
          </strong>

          <span
            style={{
              display: "block",
              color: MUTED,
              fontSize: 9.5,
              marginTop: 4,
            }}
          >
            Nesta V1 os arquivos ficam preparados na interface. Persistência e análise IA entram na V2.
          </span>
        </div>

        <input
          type="file"
          multiple
          accept=".pdf,.xml,.xlsx,.xls,.csv,.txt,.json,.docx,.zip"
          onChange={(e) =>
            adicionarArquivos(
              e.target.files
            )
          }
          style={{
            display: "none",
          }}
        />
      </label>

      {!!arquivos.length && (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 6,
          }}
        >
          {arquivos.map(
            (arquivo, index) => (
              <div
                key={`${arquivo.name}-${index}`}
                style={{
                  border:
                    "1px solid #E3E7EF",
                  borderRadius: 9,
                  padding: 9,
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: 10,
                    }}
                  >
                    {arquivo.name}
                  </strong>

                  <div
                    style={{
                      color: MUTED,
                      fontSize: 8.5,
                      marginTop: 2,
                    }}
                  >
                    {(
                      arquivo.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setArquivos(
                      (atuais) =>
                        atuais.filter(
                          (_, i) =>
                            i !== index
                        )
                    )
                  }
                  style={{
                    border: 0,
                    background:
                      "transparent",
                    color:
                      "#A12B2B",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 10,
                  }}
                >
                  Remover
                </button>
              </div>
            )
          )}
        </div>
      )}
    </Card>
  );
}

function DadosManuais({
  dados,
  setDados,
  tipoProjeto,
}) {
  function alterar(
    campo,
    valor
  ) {
    setDados(
      (atual) => ({
        ...atual,
        [campo]: valor,
      })
    );
  }

  const campos = [
    [
      "regimeAtual",
      "Regime tributário atual",
      "text",
      "Ex.: Simples Nacional",
    ],
    [
      "faturamento12m",
      "Faturamento últimos 12 meses",
      "number",
      "0,00",
    ],
    [
      "folha12m",
      "Folha + pró-labore 12 meses",
      "number",
      "0,00",
    ],
    [
      "compras12m",
      "Compras / insumos 12 meses",
      "number",
      "0,00",
    ],
    [
      "despesasDedutiveis",
      "Despesas dedutíveis estimadas",
      "number",
      "0,00",
    ],
    [
      "percentualB2B",
      "% vendas B2B",
      "number",
      "0",
    ],
    [
      "percentualB2C",
      "% vendas B2C",
      "number",
      "0",
    ],
    [
      "margemOperacional",
      "Margem operacional estimada (%)",
      "number",
      "0",
    ],
  ];

  if (
    tipoProjeto ===
    "reforma"
  ) {
    campos.push(
      [
        "creditosPotenciais",
        "Compras/despesas potencialmente geradoras de créditos",
        "number",
        "0,00",
      ],
      [
        "receitasReducao",
        "Receitas com redução/benefício estimadas",
        "number",
        "0,00",
      ]
    );
  }

  return (
    <Card>
      <strong
        style={{
          fontSize: 14,
        }}
      >
        Preenchimento manual
      </strong>

      <div
        style={{
          color: MUTED,
          fontSize: 10,
          marginTop: 4,
          marginBottom: 12,
        }}
      >
        Complete ou confirme os números utilizados na análise.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 10,
        }}
      >
        {campos.map(
          ([
            campo,
            label,
            type,
            placeholder,
          ]) => (
            <label
              key={campo}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                {label}
              </span>

              <input
                type={type}
                value={
                  dados[campo] ||
                  ""
                }
                onChange={(e) =>
                  alterar(
                    campo,
                    e.target.value
                  )
                }
                placeholder={
                  placeholder
                }
                style={inputStyle()}
              />
            </label>
          )
        )}
      </div>

      <label
        style={{
          display: "block",
          marginTop: 10,
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: 9.5,
            fontWeight: 900,
            marginBottom: 5,
          }}
        >
          Observações / premissas
        </span>

        <textarea
          rows={4}
          value={
            dados.observacoes ||
            ""
          }
          onChange={(e) =>
            alterar(
              "observacoes",
              e.target.value
            )
          }
          placeholder="Explique particularidades da operação, receitas, benefícios, retenções, créditos, sazonalidade ou premissas."
          style={{
            ...inputStyle(),
            resize: "vertical",
            fontFamily: BODY_FONT,
          }}
        />
      </label>
    </Card>
  );
}



function ReformaTributariaV2({token,onVoltar}){
 const [aba,setAba]=useState("identificacao");
 const [cnpj,setCnpj]=useState(""),[empresa,setEmpresa]=useState(null),[cnaes,setCnaes]=useState([]),[principal,setPrincipal]=useState("");
 const [responsavel,setResponsavel]=useState(""),[origem,setOrigem]=useState(""),[descricao,setDescricao]=useState(""),[regime,setRegime]=useState(""),[municipio,setMunicipio]=useState(""),[uf,setUf]=useState("");
 const [b2b,setB2b]=useState(""),[b2c,setB2c]=useState(""),[receita,setReceita]=useState(""),[compras,setCompras]=useState(""),[servicosTomados,setServicosTomados]=useState(""),[creditosAtuais,setCreditosAtuais]=useState(""),[tributosAtuais,setTributosAtuais]=useState("");
 const [setorAtividade,setSetorAtividade]=useState(""),[tipoEstabelecimento,setTipoEstabelecimento]=useState(""),[quantidadeEstabelecimentos,setQuantidadeEstabelecimentos]=useState(""),[municipiosOperacao,setMunicipiosOperacao]=useState(""),[ufsOperacao,setUfsOperacao]=useState("");
 const [anexoSimples,setAnexoSimples]=useState(""),[aliquotaEfetivaSimples,setAliquotaEfetivaSimples]=useState(""),[dasPeriodo,setDasPeriodo]=useState(""),[fatorR,setFatorR]=useState("");
 const [faturamentoAnual,setFaturamentoAnual]=useState(""),[margem,setMargem]=useState(""),[folha,setFolha]=useState(""),[proLabore,setProLabore]=useState(""),[despesasDedutiveis,setDespesasDedutiveis]=useState("");
 const [aliquotaAtual,setAliquotaAtual]=useState(""),[incentivoAtual,setIncentivoAtual]=useState("NORMAL"),[reducaoIbsCbs,setReducaoIbsCbs]=useState("0"),[exportacao,setExportacao]=useState("0"),[tratamentoEspecial,setTratamentoEspecial]=useState("");
 const [documentos,setDocumentos]=useState([]),[documentosIa,setDocumentosIa]=useState([]),[extracao,setExtracao]=useState(null),[analise,setAnalise]=useState(null),[simulacao,setSimulacao]=useState(null);
 const [erro,setErro]=useState(""),[ok,setOk]=useState(""),[carregando,setCarregando]=useState(false),[extraindo,setExtraindo]=useState(false);
 const [projetoId]=useState(()=>{try{return crypto.randomUUID()}catch{return `reforma_${Date.now()}`}});
 const tabs=[["identificacao","1. Empresa"],["operacao","2. Operação"],["dados","3. Dados econômicos"],["documentos","4. Documentos IA"],["ibscbs","5. IBS / CBS"],["simulacao","6. Simulações"],["motor","7. Recomendação"],["impacto","8. Impactos"],["transicao","9. Transição"],["relatorio","10. Relatório"]];
 const n=v=>Number(String(v??"").replace(/\./g,"").replace(",","."))||0;
 const input={width:"100%",border:"1px solid #DDE3EC",borderRadius:8,padding:"9px 10px",fontSize:10,boxSizing:"border-box"};
 const card={background:"#fff",border:"1px solid #E3E7EF",borderRadius:12,padding:14};
 const digits=v=>String(v||"").replace(/\D/g,"");
 const field=(label,value,setter,placeholder="",help="")=><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>{label}<input value={value} onChange={e=>setter(e.target.value)} placeholder={placeholder} style={input}/>{help&&<small style={{fontWeight:500,color:"#697386"}}>{help}</small>}</label>;
 const list=(titulo,itens)=><div style={card}><b>{titulo}</b>{itens?.length?<ul>{itens.map((x,i)=><li key={i} style={{fontSize:9.5,lineHeight:1.5}}>{x}</li>)}</ul>:<p style={{fontSize:9,color:"#697386"}}>Nenhum item confirmado.</p>}</div>;
 async function apiCall(action,{method="GET",body=null,query={}}={}){const p=new URLSearchParams({action});Object.entries(query).forEach(([k,v])=>v!==""&&v!=null&&p.set(k,String(v)));const r=await fetch(`/api/tributario?${p}`,{method,headers:{...(body?{"content-type":"application/json"}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>null);if(!r.ok||!d?.sucesso)throw new Error(d?.error||"Erro no módulo tributário.");return d}
 async function arquivoParaDataUrl(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error(`Não foi possível ler ${file.name}.`));reader.readAsDataURL(file)})}
 function normalizarCnaes(data){const p=data?.cnaePrincipal||data?.cnae?.principal||null,s=data?.cnaesSecundarios||data?.cnae?.secundarios||[],todos=data?.todosCnaes||data?.cnae?.todos||[p,...s].filter(Boolean);return(todos||[]).map((x,i)=>({codigo:String(x?.codigo||x?.cnae||""),descricao:x?.descricao||"",principal:Boolean(x?.principal||x?.tipo==="principal"||i===0&&p)})).filter(x=>x.codigo||x.descricao)}
 async function consultarCnpj(valor=cnpj){const c=digits(valor);if(c.length!==14)throw new Error("CNPJ inválido para consulta cadastral.");const r=await fetch(`/api/cnpj?cnpj=${c}`),d=await r.json().catch(()=>null);if(!r.ok||!d?.sucesso)throw new Error(d?.error||"CNPJ não localizado.");setEmpresa(d);setCnpj(c);setMunicipio(d.municipio||d.endereco?.municipio||"");setUf(d.uf||d.endereco?.uf||"");const lista=normalizarCnaes(d);setCnaes(lista);const p=lista.find(x=>x.principal)||lista[0];setPrincipal(p?.codigo||"");return{dados:d,cnaes:lista}}
 async function buscarCnpj(){try{setErro("");await consultarCnpj(cnpj);setOk("CNPJ e CNAEs atualizados pela consulta cadastral.")}catch(e){setErro(e.message)}}
 const EXTENSOES_SUPORTADAS_IA=new Set([
  "art","bat","brf","c","cls","css","csv","diff","doc","docx","dot","eml","epub","es",
  "h","hs","htm","html","hwp","hwpx","ics","ifb","java","js","json","keynote","ksh","ltx",
  "mail","markdown","md","mht","mhtml","mjs","msg","nws","odp","ods","odt","otp","ots",
  "pages","patch","pdf","pl","pm","pot","potm","potx","ppa","pps","ppsm","ppsx","ppt",
  "pptm","pptx","pwz","py","rst","rtf","scala","sh","shtml","srt","sty","svg","svgz",
  "tex","text","txt","tsv","vcf","vtt","wiz","xla","xlb","xlc","xlm","xls","xlsx","xlt",
  "xlw","xml","yaml","yml"
 ]);

 function extensaoArquivo(nome){
  const partes=String(nome||"").toLowerCase().split(".");
  return partes.length>1?partes.pop():"";
 }

 function arquivoSuportadoIA(arq){
  return EXTENSOES_SUPORTADAS_IA.has(extensaoArquivo(arq?.name));
 }

 function adicionarDocumentos(novos){
  const lista=Array.from(novos||[]);
  if(!lista.length)return;

  const invalidos=lista.filter(arq=>!arquivoSuportadoIA(arq));
  const validos=lista.filter(arquivoSuportadoIA);

  if(invalidos.length){
    const nomes=invalidos.map(a=>`${a.name} (.${extensaoArquivo(a.name)||"sem extensão"})`).join(", ");
    setErro(
      `Arquivo(s) não suportado(s) pela IA: ${nomes}. `+
      `Exemplo: arquivos .REC não são aceitos. Converta para PDF, DOCX, XLSX, CSV, TXT, XML ou outro formato suportado antes de anexar.`
    );
  }else{
    setErro("");
  }

  if(!validos.length)return;

  setDocumentos(atuais=>{
    const mapa=new Map();
    [...atuais,...validos].forEach(arq=>{
      const chave=`${arq.name}__${arq.size}__${arq.lastModified}`;
      if(!mapa.has(chave))mapa.set(chave,arq);
    });
    return Array.from(mapa.values());
  });
 }

 function removerDocumento(indice){
  setDocumentos(atuais=>atuais.filter((_,i)=>i!==indice));
 }

 function limparDocumentos(){
  setDocumentos([]);
 }

 function aplicarExtracao(x){
  if(!x)return;
  setExtracao(x);

  const id=x.identificacao||{};
  const op=x.operacao||{};
  const ec=x.economicos||x.valores||{};
  const sm=x.simples||{};
  const tr=x.tributos||{};
  const tt=x.tratamentos||{};

  const c=digits(id.cnpj);
  if(c)setCnpj(c);
  if(id.razaoSocial)setEmpresa(at=>({...at,razaoSocial:id.razaoSocial,nomeFantasia:id.nomeFantasia||at?.nomeFantasia}));
  if(id.municipio)setMunicipio(id.municipio);
  if(id.uf)setUf(id.uf);
  if(id.regime)setRegime(id.regime);

  if(op.descricao)setDescricao(op.descricao);
  if(op.setorAtividade)setSetorAtividade(op.setorAtividade);
  if(op.tipoEstabelecimento)setTipoEstabelecimento(op.tipoEstabelecimento);
  if(op.quantidadeEstabelecimentos!=null)setQuantidadeEstabelecimentos(String(op.quantidadeEstabelecimentos));
  if(Array.isArray(op.municipiosOperacao)&&op.municipiosOperacao.length)setMunicipiosOperacao(op.municipiosOperacao.join(", "));
  if(Array.isArray(op.ufsOperacao)&&op.ufsOperacao.length)setUfsOperacao(op.ufsOperacao.join(", "));
  if(op.b2bPct!=null)setB2b(String(op.b2bPct));
  if(op.b2cPct!=null)setB2c(String(op.b2cPct));
  if(op.exportacaoPct!=null)setExportacao(String(op.exportacaoPct));

  if(ec.receitaPeriodo!=null)setReceita(String(ec.receitaPeriodo));
  if(ec.faturamentoAnual!=null)setFaturamentoAnual(String(ec.faturamentoAnual));
  else if(ec.rbt12!=null)setFaturamentoAnual(String(ec.rbt12));
  if(ec.comprasPeriodo!=null)setCompras(String(ec.comprasPeriodo));
  if(ec.servicosTomadosPeriodo!=null)setServicosTomados(String(ec.servicosTomadosPeriodo));
  if(ec.custosDespesasAnuais!=null)setDespesasDedutiveis(String(ec.custosDespesasAnuais));
  else if(ec.custosDespesasPeriodo!=null)setDespesasDedutiveis(String(ec.custosDespesasPeriodo));
  if(ec.margemLucroPct!=null)setMargem(String(ec.margemLucroPct));
  if(ec.folhaMensal!=null)setFolha(String(ec.folhaMensal));
  if(ec.proLaboreMensal!=null)setProLabore(String(ec.proLaboreMensal));

  if(tr.creditosAtuais!=null)setCreditosAtuais(String(tr.creditosAtuais));
  if(tr.totalPeriodo!=null)setTributosAtuais(String(tr.totalPeriodo));
  if(tr.aliquotaIssPct!=null)setAliquotaAtual(String(tr.aliquotaIssPct));
  else if(tr.aliquotaIcmsPct!=null)setAliquotaAtual(String(tr.aliquotaIcmsPct));

  if(sm.anexo)setAnexoSimples(sm.anexo);
  if(sm.aliquotaEfetivaPct!=null)setAliquotaEfetivaSimples(String(sm.aliquotaEfetivaPct));
  if(sm.dasPeriodo!=null)setDasPeriodo(String(sm.dasPeriodo));
  if(sm.fatorRPct!=null)setFatorR(String(sm.fatorRPct));

  if(tt.incentivoPisCofins)setIncentivoAtual("PIS_COFINS");
  else if(tt.incentivoIcms)setIncentivoAtual("ICMS");
  else if(tt.incentivoIss)setIncentivoAtual("ISS");

  const tratamentos=[
    tt.beneficioSetorial,
    tt.incentivoPisCofins,
    tt.incentivoIcms,
    tt.incentivoIss,
    ...(Array.isArray(tt.observacoes)?tt.observacoes:[])
  ].filter(Boolean);
  if(tratamentos.length)setTratamentoEspecial(tratamentos.join(" | "));
 }
 async function interpretarDocumentos(){
  if(!documentos.length){setErro("Selecione pelo menos um documento.");return}

  const invalidos=documentos.filter(arq=>!arquivoSuportadoIA(arq));
  if(invalidos.length){
    setErro(
      `Não é possível interpretar: ${invalidos.map(a=>a.name).join(", ")}. `+
      `O formato não é suportado pela IA. Remova o arquivo ou converta para PDF, DOCX, XLSX, CSV, TXT ou XML.`
    );
    return;
  }

  setExtraindo(true);setErro("");setOk("");try{const up=[];for(const file of documentos){const fileData=await arquivoParaDataUrl(file);const u=await apiCall("upload-file",{method:"POST",body:{filename:file.name,mimeType:file.type||"application/octet-stream",fileData}});up.push({fileId:u.fileId,filename:file.name,mimeType:file.type||"",bytes:file.size})}setDocumentosIa(up);const d=await apiCall("reforma-extrair",{method:"POST",body:{projetoId,arquivos:up}});aplicarExtracao(d.extracao);const c=digits(d.extracao?.identificacao?.cnpj);if(c.length===14){try{const cad=await consultarCnpj(c);setOk(`IA identificou o CNPJ e o sistema consultou ${cad.cnaes.length} CNAE(s) oficiais.`)}catch{setOk("IA interpretou os documentos e identificou o CNPJ, mas a consulta cadastral precisa ser validada.")}}else setOk("IA interpretou os documentos. Confirme o CNPJ manualmente.");setAba("identificacao")}catch(e){setErro(e.message)}finally{setExtraindo(false)}}
 function baseAtual(){return{identificacao:{cnpj:digits(cnpj),razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||"",municipio,uf,regime,responsavel,origem},atividades:{cnaes,principal,descricaoReal:descricao},operacao:{descricao,setorAtividade,tipoEstabelecimento,quantidadeEstabelecimentos:n(quantidadeEstabelecimentos),municipiosOperacao,ufsOperacao,b2b:n(b2b),b2c:n(b2c),exportacaoPct:n(exportacao)},valores:{receita:n(receita),faturamentoAnual:n(faturamentoAnual),compras:n(compras),servicosTomados:n(servicosTomados),creditosAtuais:n(creditosAtuais),tributosAtuais:n(tributosAtuais),margemRealPct:n(margem),folhaMensal:n(folha),proLaboreMensal:n(proLabore),despesasDedutiveisAnuais:n(despesasDedutiveis),aliquotaAtualIssIcmsPct:n(aliquotaAtual)},simples:{anexo:anexoSimples,aliquotaEfetivaPct:n(aliquotaEfetivaSimples),dasPeriodo:n(dasPeriodo),fatorRPct:n(fatorR)},tratamentos:{incentivoAtual,reducaoIbsCbsPct:n(reducaoIbsCbs),tratamentoEspecial},extracao,simulacao}}
 async function analisar(){setCarregando(true);setErro("");setOk("");try{const d=await apiCall("reforma-analisar",{method:"POST",body:{projetoId,base:baseAtual(),extracaoOriginal:extracao,documentos:documentosIa.length?documentosIa:documentos.map(x=>({filename:x.name,mimeType:x.type,bytes:x.size}))}});setAnalise(d.analise);setAba("ibscbs");setOk("Diagnóstico da Reforma Tributária atualizado.")}catch(e){setErro(e.message)}finally{setCarregando(false)}}
 async function salvar(status="EM_ANALISE"){try{await apiCall("salvar-projeto",{method:"POST",body:{id:projetoId,tipoProjeto:"reforma",estrutura:"empresa",modalidade:documentos.length?"hibrido":"manual",responsavelFinder:responsavel,origemCliente:origem,empresas:[{cnpj:digits(cnpj),razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||""}],atividades:{selecionadas:cnaes,principalReal:principal,descricaoReal:descricao},dadosManuais:{reformaV2:baseAtual(),analise,extracao,simulacao},status}});setOk("Reforma Tributária salva.")}catch(e){setErro(e.message)}}
 const fatSim=faturamentoAnual||receita;

 const motor=useMemo(()=>{
  const matriz=Array.isArray(analise?.matrizImpacto)?analise.matrizImpacto:[];
  const altos=matriz.filter(x=>String(x?.nivel||"").toUpperCase()==="ALTO").length;
  const medios=matriz.filter(x=>String(x?.nivel||"").toUpperCase()==="MEDIO").length;
  const naoAvaliados=matriz.filter(x=>String(x?.nivel||"").toUpperCase()==="NAO_AVALIADO").length;
  const faltantes=Array.isArray(analise?.dadosFaltantes)?analise.dadosFaltantes.length:0;
  const confianca=String(analise?.confianca||extracao?.confiancaGeral||"BAIXA").toUpperCase();

  let risco="NÃO AVALIADO";
  if(analise){
   if(altos>=3)risco="ALTO";
   else if(altos>=1||medios>=4)risco="ATENÇÃO";
   else if(naoAvaliados>4||faltantes>4)risco="BASE INCOMPLETA";
   else risco="CONTROLADO";
  }

  const ibsCbs=simulacao?.ibsCbs||{};
  const simplesCalc=simulacao?.simples||{};
  const cargaIbsCbs=n(ibsCbs?.cargaEfetiva);
  const totalIbsCbs=n(ibsCbs?.total);
  const tribAtual=n(tributosAtuais);
  const basePeriodo=n(receita)||n(fatSim);
  const cargaAtualInformada=basePeriodo>0&&tribAtual>0?(tribAtual/basePeriodo)*100:null;

  let recomendacao="Base insuficiente para recomendar";
  let explicacao="Importe os documentos, confira os dados e gere o diagnóstico antes de definir uma estratégia.";
  let recomendado="PENDENTE";

  const reg=String(regime||"").toLowerCase();
  const menor=String(simplesCalc?.menorCargaMatematica||"").toLowerCase();

  if(analise&&simulacao){
   if(reg.includes("simples")&&simplesCalc?.fora!=null){
    if(menor.includes("fora")){
     recomendacao="Simples com IBS/CBS por fora — candidato à validação";
     explicacao="O cenário matemático por fora ficou menor na simulação. Antes de aplicar, valide perfil B2B/B2C, geração de créditos, preço, margem e requisitos legais.";
     recomendado="HIBRIDO";
    }else if(menor.includes("dentro")){
     recomendacao="Simples Nacional com IBS/CBS dentro — candidato à validação";
     explicacao="O cenário matemático dentro ficou menor na simulação. A decisão final deve considerar crédito para clientes PJ, margem, cadeia de fornecedores e requisitos legais.";
     recomendado="SIMPLES";
    }else{
     recomendacao="Simples Nacional — comparação ainda incompleta";
     explicacao="Faltam parâmetros para comparar de forma confiável o IBS/CBS dentro e por fora.";
    }
   }else{
    recomendacao="Estratégia IBS/CBS do regime atual — validar";
    explicacao="O módulo da Reforma avalia consumo, créditos, cadeia B2B/B2C e transição. A troca entre Simples, Presumido e Real permanece no Planejamento Tributário.";
    recomendado="REGIME_ATUAL";
   }
  }

  const cobertura=[
   {nome:"Empresa/CNPJ",ok:digits(cnpj).length===14},
   {nome:"Operação real",ok:Boolean(descricao)},
   {nome:"Faturamento",ok:n(fatSim)>0},
   {nome:"Compras/créditos",ok:n(compras)>0||n(creditosAtuais)>0},
   {nome:"B2B/B2C",ok:n(b2b)+n(b2c)>0},
   {nome:"Documentos IA",ok:Boolean(extracao)||documentosIa.length>0},
   {nome:"Diagnóstico IA",ok:Boolean(analise)},
   {nome:"Simulação",ok:Boolean(simulacao)}
  ];
  const completos=cobertura.filter(x=>x.ok).length;
  const coberturaPct=Math.round(completos/cobertura.length*100);

  return{
   risco,altos,medios,naoAvaliados,faltantes,confianca,
   totalIbsCbs,cargaIbsCbs,cargaAtualInformada,
   recomendacao,explicacao,recomendado,cobertura,coberturaPct,
   plano:Array.isArray(analise?.planoAcao)?analise.planoAcao.slice(0,5):[],
   riscos:Array.isArray(analise?.riscos)?analise.riscos.slice(0,5):[],
   oportunidades:Array.isArray(analise?.oportunidades)?analise.oportunidades.slice(0,5):[]
  };
 },[analise,extracao,simulacao,regime,tributosAtuais,receita,fatSim,cnpj,descricao,compras,creditosAtuais,b2b,b2c,documentosIa]);

 const transicaoModelo=useMemo(()=>[
  {ano:"2026",ibs:0,antigos:100,fase:"Teste",descricao:"CBS 0,9% e IBS 0,1% em fase de teste/compensação, observadas as regras aplicáveis."},
  {ano:"2027",ibs:0.1,antigos:100,fase:"CBS entra",descricao:"CBS passa a substituir PIS/Cofins; IBS permanece em 0,1 p.p.; IPI é reduzido a zero nas hipóteses gerais, ressalvadas exceções."},
  {ano:"2028",ibs:0.1,antigos:100,fase:"Preparação",descricao:"CBS em vigor e IBS ainda em transição inicial."},
  {ano:"2029",ibs:10,antigos:90,fase:"10% IBS",descricao:"10% da transição ICMS/ISS para IBS e 90% dos tributos antigos."},
  {ano:"2030",ibs:20,antigos:80,fase:"20% IBS",descricao:"20% IBS e 80% ICMS/ISS."},
  {ano:"2031",ibs:30,antigos:70,fase:"30% IBS",descricao:"30% IBS e 70% ICMS/ISS."},
  {ano:"2032",ibs:40,antigos:60,fase:"40% IBS",descricao:"40% IBS e 60% ICMS/ISS."},
  {ano:"2033",ibs:100,antigos:0,fase:"Modelo pleno",descricao:"Vigência integral do novo modelo e extinção de ICMS/ISS."}
 ],[]);

 const comparativoRelatorio=useMemo(()=>{
  const dentro=n(simulacao?.simples?.dentro);
  const fora=simulacao?.simples?.fora==null?null:n(simulacao?.simples?.fora);
  const residual=simulacao?.simples?.dasResidualEstimado?.residual;
  const ibscbs=n(simulacao?.ibsCbs?.total);
  const diff=fora==null?null:fora-dentro;
  const pctDiff=dentro>0&&diff!=null?(diff/dentro)*100:null;
  const cargaAtual=n(tributosAtuais);
  return{dentro,fora,residual,ibscbs,diff,pctDiff,cargaAtual};
 },[simulacao,tributosAtuais]);

 const corRisco=motor.risco==="ALTO"?"#B42318":motor.risco==="ATENÇÃO"?"#B7791F":motor.risco==="CONTROLADO"?"#176B47":"#697386";
 const moedaMotor=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const pctMotor=v=>v==null?"Pendente":`${Number(v||0).toFixed(2)}%`;
 const barraMotor=(label,valor,maximo,cor="#17233D")=><div style={{display:"grid",gridTemplateColumns:"150px 1fr 85px",gap:8,alignItems:"center",fontSize:9}}><b>{label}</b><div style={{height:10,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${maximo?Math.max(2,Math.min(100,(valor/maximo)*100)):2}%`,background:cor,borderRadius:999}}/></div><b style={{textAlign:"right"}}>{valor}</b></div>;

 return <div style={{fontFamily:"Arial, sans-serif",color:"#17233D"}}>
  <button onClick={onVoltar} style={{border:0,background:"transparent",cursor:"pointer",fontWeight:800,color:"#697386",marginBottom:10}}>← Voltar</button>
  <div style={{background:"linear-gradient(135deg,#0E1A33,#17233D)",color:"#fff",borderRadius:16,padding:18,marginBottom:12}}><div style={{fontSize:9,fontWeight:900,color:"#FFB7A7"}}>FINDER INTELLIGENCE · REFORMA TRIBUTÁRIA</div><h2 style={{margin:"5px 0"}}>IBS, CBS, Simples dentro/fora e impacto financeiro</h2><div style={{fontSize:10,color:"#D8DEEA"}}>A IA lê os documentos e adapta a análise à empresa; o motor cruza operação real, CNAEs oficiais, créditos, B2B/B2C, cálculo auditável, riscos e transição.</div></div>
  {erro&&<div style={{...card,borderColor:"#E7B9B9",color:"#A22",marginBottom:9}}>{erro}</div>}{ok&&<div style={{...card,borderColor:"#B9DFC8",color:"#176B47",marginBottom:9}}>{ok}</div>}
  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{tabs.map(([k,l])=><button key={k} onClick={()=>setAba(k)} style={{border:"1px solid #DDE3EC",borderRadius:999,padding:"7px 9px",background:aba===k?"#17233D":"#fff",color:aba===k?"#fff":"#17233D",fontSize:8.5,fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div>

  {aba==="identificacao"&&<div style={{display:"grid",gap:10}}><div style={card}><h3>Dados da empresa</h3><div style={{display:"grid",gridTemplateColumns:"2fr auto",gap:7}}>{field("CNPJ",cnpj,setCnpj,"00.000.000/0000-00")}<button onClick={buscarCnpj} style={{alignSelf:"end",padding:"9px 12px"}}>Consultar CNPJ</button></div>{empresa&&<p style={{fontSize:10}}><b>{empresa.razaoSocial||empresa.razao_social||empresa.nome}</b></p>}<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>{field("Responsável Finder",responsavel,setResponsavel)}{field("Origem",origem,setOrigem)}{field("Município",municipio,setMunicipio)}{field("UF",uf,setUf)}</div><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800,marginTop:8}}>Regime atual<select value={regime} onChange={e=>setRegime(e.target.value)} style={input}><option value="">Selecione</option><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option></select></label></div><div style={card}><h3>CNAEs oficiais</h3>{cnaes.length?cnaes.map((x,i)=><label key={`${x.codigo}_${i}`} style={{display:"flex",gap:8,padding:"7px 0",borderBottom:"1px solid #EEF0F4",fontSize:9.5}}><input type="radio" checked={principal===x.codigo} onChange={()=>setPrincipal(x.codigo)}/><span><b>{x.codigo}</b> — {x.descricao}{x.principal?" · principal cadastral":""}</span></label>):<p style={{fontSize:9,color:"#697386"}}>Carregados pela consulta do CNPJ, inclusive quando o CNPJ for identificado pela IA nos documentos.</p>}</div></div>}

  {aba==="operacao"&&<div style={card}><h3>Operação real</h3><textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={5} style={{...input,resize:"vertical"}} placeholder="O que vende/presta, clientes, fornecedores, local da operação, particularidades..."/><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}}>{field("Setor da atividade",setorAtividade,setSetorAtividade)}{field("Tipo de estabelecimento",tipoEstabelecimento,setTipoEstabelecimento,"Empresa única / múltiplos estabelecimentos")}{field("Quantidade de estabelecimentos",quantidadeEstabelecimentos,setQuantidadeEstabelecimentos)}{field("Municípios de operação",municipiosOperacao,setMunicipiosOperacao)}{field("UFs de operação",ufsOperacao,setUfsOperacao)}{field("% B2B",b2b,setB2b)}{field("% B2C",b2c,setB2c)}{field("% exportação",exportacao,setExportacao)}</div><p style={{fontSize:9,color:"#697386"}}>A IA preenche apenas o que conseguir comprovar. CNAE continua vindo da consulta oficial do CNPJ.</p></div>}

  {aba==="dados"&&<div style={{display:"grid",gap:10}}><div style={card}><h3>Dados econômicos para simulação</h3><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>{field("Receita do período",receita,setReceita,"R$")}{field("Faturamento anual / RBT12",faturamentoAnual,setFaturamentoAnual,"R$")}{field("Compras do período",compras,setCompras,"R$")}{field("Serviços tomados",servicosTomados,setServicosTomados,"R$")}{field("Margem de lucro real estimada %",margem,setMargem,"%")}{field("Folha mensal — empregados",folha,setFolha,"R$")}{field("Pró-labore mensal",proLabore,setProLabore,"R$")}{field("Despesas/custos anuais dedutíveis",despesasDedutiveis,setDespesasDedutiveis,"R$")}{field("Tributos atuais do período",tributosAtuais,setTributosAtuais,"R$")}{field("Créditos atuais",creditosAtuais,setCreditosAtuais,"R$")}{field("Alíquota atual ISS/ICMS %",aliquotaAtual,setAliquotaAtual,"%")}</div></div><div style={card}><h3>Simples Nacional — dados encontrados</h3><div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>{field("Anexo",anexoSimples,setAnexoSimples)}{field("Alíquota efetiva %",aliquotaEfetivaSimples,setAliquotaEfetivaSimples,"%")}{field("DAS do período",dasPeriodo,setDasPeriodo,"R$")}{field("Fator R %",fatorR,setFatorR,"%")}</div></div><div style={card}><h3>Tratamentos e particularidades</h3><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>Incentivo fiscal atual<select value={incentivoAtual} onChange={e=>setIncentivoAtual(e.target.value)} style={input}><option value="NORMAL">Sem incentivo informado</option><option value="PIS_COFINS">Incentivo PIS/Cofins</option><option value="ICMS">Incentivo ICMS</option><option value="ISS">Incentivo ISS</option><option value="OUTRO">Outro</option></select></label>{field("Redução IBS/CBS a validar %",reducaoIbsCbs,setReducaoIbsCbs,"%")}</div>{field("Tratamento setorial/especial",tratamentoEspecial,setTratamentoEspecial,"Saúde, educação, exportação, regime específico etc.")}</div></div>}

  {aba==="documentos"&&<div style={{display:"grid",gap:10}}><div style={card}>
   <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start",flexWrap:"wrap"}}>
    <div>
     <h3 style={{margin:"0 0 4px"}}>Documentos para interpretação da IA</h3>
     <p style={{fontSize:9,color:"#697386",margin:0}}>Você pode adicionar arquivos em momentos diferentes. Os novos anexos serão somados aos que já estão na lista.</p>
    </div>
    <span style={{background:"#EEF3FF",color:"#31589C",borderRadius:999,padding:"5px 8px",fontSize:9,fontWeight:900}}>{documentos.length} arquivo(s)</span>
   </div>

   <label style={{display:"inline-flex",alignItems:"center",gap:7,marginTop:12,padding:"9px 12px",border:"1px dashed #AEB8C8",borderRadius:9,background:"#F8FAFD",fontSize:10,fontWeight:800,cursor:"pointer"}}>
    + Adicionar documentos
    <input
     type="file"
     multiple
     accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.xml,.md,.rtf,.odt,.ods,.ppt,.pptx,.html,.yaml,.yml,.eml,.msg"
     style={{display:"none"}}
     onChange={e=>{
      adicionarDocumentos(e.target.files);
      e.target.value="";
     }}
    />
   </label>

   <div style={{marginTop:8,padding:"8px 10px",background:"#FFF8E7",border:"1px solid #F3D99B",borderRadius:8,fontSize:8.5,color:"#805B10"}}>
    Formatos como <b>.REC</b> não são suportados pela IA. Se o documento estiver nesse formato, converta antes para PDF, DOCX, XLSX, CSV, TXT ou XML.
   </div>

   {!!documentos.length&&<div style={{display:"grid",gap:6,marginTop:10}}>
    {documentos.map((arq,i)=><div key={`${arq.name}_${arq.size}_${arq.lastModified}_${i}`} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",padding:"8px 9px",border:"1px solid #E7EAF0",borderRadius:8,background:"#FBFCFE"}}>
     <div style={{minWidth:0}}>
      <div style={{fontSize:9.5,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{arq.name}</div>
      <div style={{fontSize:8,color:"#697386"}}>{(arq.size/1024/1024).toFixed(2)} MB</div>
     </div>
     <button type="button" onClick={()=>removerDocumento(i)} disabled={extraindo} style={{border:"1px solid #F0C7BD",background:"#FFF6F3",color:"#A5422A",borderRadius:7,padding:"5px 8px",fontSize:8.5,fontWeight:800,cursor:"pointer"}}>Remover</button>
    </div>)}
   </div>}

   <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:10}}>
    <button onClick={interpretarDocumentos} disabled={extraindo||!documentos.length} style={{padding:"9px 12px",fontWeight:800}}>
     {extraindo?"Interpretando documentos...":extracao?"Reinterpretar todos os documentos":"Interpretar documentos com IA"}
    </button>
    {!!documentos.length&&<button type="button" onClick={limparDocumentos} disabled={extraindo} style={{padding:"9px 12px",fontWeight:800,border:"1px solid #D8DEEA",background:"#fff",borderRadius:7,cursor:"pointer"}}>Limpar lista</button>}
   </div>

   <p style={{fontSize:8.5,color:"#697386",margin:"8px 0 0"}}>Ao adicionar um novo arquivo depois da primeira análise, clique em <b>Reinterpretar todos os documentos</b> para a IA consolidar os anexos antigos + novos.</p>
  </div>{extracao&&<div style={card}><h3>Auditoria da extração</h3><p style={{fontSize:9.5}}><b>Documentos:</b> {(extracao.documentosReconhecidos||[]).join(", ")||"-"} · <b>Confiança:</b> {extracao.confiancaGeral||"-"}</p>{(extracao.fontes||[]).map((x,i)=><div key={i} style={{fontSize:9,padding:"5px 0",borderBottom:"1px solid #EEF0F4"}}><b>{x.campo}</b>: {x.valor} <span style={{color:"#697386"}}>({x.documento} · {x.confianca})</span></div>)}{!!extracao.divergencias?.length&&<>{list("Divergências",extracao.divergencias)}</>}{!!extracao.dadosNaoComprovados?.length&&<>{list("Não comprovado nos documentos",extracao.dadosNaoComprovados)}</>}{!!extracao.sugestoesPreenchimentoManual?.length&&<>{list("Complete manualmente para melhorar a análise",extracao.sugestoesPreenchimentoManual)}</>}</div>}</div>}

  {aba==="ibscbs"&&<div style={{display:"grid",gap:9}}><div style={card}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><div><h3 style={{margin:0}}>Diagnóstico técnico IBS / CBS</h3><p style={{fontSize:9,color:"#697386"}}>A IA interpreta riscos, créditos, B2B/B2C e impactos. O cálculo financeiro fica separado e auditável.</p></div><button onClick={analisar} disabled={carregando} style={{padding:"9px 13px",fontWeight:800}}>{carregando?"Analisando...":"Gerar/atualizar diagnóstico"}</button></div></div>{analise&&<><div style={card}><p style={{fontSize:10,lineHeight:1.6}}>{analise.resumo}</p><p style={{fontSize:9,color:"#697386"}}><b>Confiança:</b> {analise.confianca} · <b>Data-base:</b> {analise.dataBase}</p></div>{list("Impactos identificados",analise.impactos)}{list("Créditos e validações",analise.creditos)}{list("Precificação e margem",analise.precificacao)}{list("Fundamentação / benefícios a validar",analise.fundamentacao)}{list("Dados faltantes",analise.dadosFaltantes)}</>}</div>}

  {aba==="simulacao"&&<ReformaSimulador dadosIniciais={{faturamento:n(fatSim),tributosAtuais:n(tributosAtuais),dasAtual:n(dasPeriodo),aliquotaAtual:n(aliquotaAtual),creditoCBS:0,creditoIBS:n(creditosAtuais),reducaoCBS:n(reducaoIbsCbs),reducaoIBS:n(reducaoIbsCbs),b2b:n(b2b),b2c:n(b2c),componentesDas:{pis:n(extracao?.tributos?.pis),cofins:n(extracao?.tributos?.cofins),icms:n(extracao?.tributos?.icms),iss:n(extracao?.tributos?.iss),ipi:n(extracao?.tributos?.ipi),cpp:n(extracao?.tributos?.cpp),irpj:n(extracao?.tributos?.irpj),csll:n(extracao?.tributos?.csll),outros:n(extracao?.tributos?.outros)}}} onResultado={setSimulacao}/>}

  {aba==="motor"&&<div style={{display:"grid",gap:10}}>
   <div style={{...card,background:"linear-gradient(135deg,#101B33,#17233D)",color:"#fff",border:0}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}>
     <div style={{maxWidth:760}}>
      <div style={{fontSize:8.5,fontWeight:900,color:"#FFB7A7",letterSpacing:.5}}>MOTOR FINDER · RECOMENDAÇÃO ASSISTIDA</div>
      <h2 style={{margin:"5px 0 7px",fontSize:22}}>{motor.recomendacao}</h2>
      <p style={{margin:0,fontSize:10,lineHeight:1.6,color:"#D8DEEA"}}>{motor.explicacao}</p>
     </div>
     <div style={{display:"grid",gap:5,justifyItems:"end"}}>
      <span style={{background:`${corRisco}22`,border:`1px solid ${corRisco}`,color:motor.risco==="CONTROLADO"?"#8CE1B6":"#FFB7A7",padding:"6px 9px",borderRadius:999,fontSize:8.5,fontWeight:900}}>RISCO: {motor.risco}</span>
      <span style={{fontSize:8.5,color:"#BFC8D8"}}>Confiança IA: <b>{motor.confianca}</b></span>
     </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginTop:14}}>
     <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:11}}><div style={{fontSize:8,color:"#BFC8D8",fontWeight:900}}>COBERTURA DA BASE</div><div style={{fontSize:20,fontWeight:900,marginTop:3}}>{motor.coberturaPct}%</div></div>
     <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:11}}><div style={{fontSize:8,color:"#BFC8D8",fontWeight:900}}>TRIBUTOS ATUAIS INFORMADOS</div><div style={{fontSize:20,fontWeight:900,marginTop:3}}>{moedaMotor(n(tributosAtuais))}</div><div style={{fontSize:8,color:"#BFC8D8"}}>{motor.cargaAtualInformada==null?"Sem base comparável":`${pctMotor(motor.cargaAtualInformada)} da base informada`}</div></div>
     <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:11}}><div style={{fontSize:8,color:"#BFC8D8",fontWeight:900}}>IBS + CBS SIMULADO</div><div style={{fontSize:20,fontWeight:900,marginTop:3,color:"#FFB7A7"}}>{simulacao?moedaMotor(motor.totalIbsCbs):"Pendente"}</div><div style={{fontSize:8,color:"#BFC8D8"}}>{simulacao?`${pctMotor(motor.cargaIbsCbs)} da base simulada`:"Execute a simulação"}</div></div>
     <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:11}}><div style={{fontSize:8,color:"#BFC8D8",fontWeight:900}}>DADOS FALTANTES</div><div style={{fontSize:20,fontWeight:900,marginTop:3}}>{motor.faltantes}</div><div style={{fontSize:8,color:"#BFC8D8"}}>Itens materiais apontados pela IA</div></div>
    </div>
   </div>

   <div style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:10}}>
    <div style={card}>
     <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
      <div><h3 style={{margin:"0 0 3px"}}>As três estratégias</h3><div style={{fontSize:8.7,color:"#697386"}}>A indicação é assistida. Nenhuma opção é aplicada automaticamente.</div></div>
      <button onClick={analisar} disabled={carregando} style={{padding:"8px 10px",fontWeight:800}}>{carregando?"Atualizando...":"Atualizar motor com IA"}</button>
     </div>

     <div style={{display:"grid",gap:7,marginTop:10}}>
      {[
       ["SIMPLES","Simples Nacional","IBS/CBS conforme tratamento do Simples. Pode ser interessante em operações B2C e quando a simplicidade/apuração pesar mais que o crédito integral."],
       ["HIBRIDO","Simples com IBS/CBS por fora","Mantém a empresa no Simples para os demais tributos e avalia IBS/CBS no regime regular, quando juridicamente permitido e economicamente vantajoso."],
       ["REGIME_ATUAL","Regime regular / regime atual","Avalia débito e créditos de IBS/CBS no regime regular. A escolha Presumido x Real pertence ao módulo Planejamento Tributário."]
      ].map(([id,t,d])=><div key={id} style={{border:`1px solid ${motor.recomendado===id?"#55B68B":"#E3E7EF"}`,background:motor.recomendado===id?"#F1FBF6":"#FBFCFE",borderRadius:10,padding:10}}>
       <div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:10.5}}>{t}</b>{motor.recomendado===id&&<span style={{background:"#176B47",color:"#fff",borderRadius:999,padding:"3px 7px",fontSize:7.5,fontWeight:900}}>CANDIDATO</span>}</div>
       <div style={{fontSize:8.7,color:"#697386",lineHeight:1.5,marginTop:3}}>{d}</div>
      </div>)}
     </div>
    </div>

    <div style={card}>
     <h3 style={{margin:"0 0 3px"}}>Qualidade da análise</h3>
     <div style={{fontSize:8.7,color:"#697386",marginBottom:10}}>A recomendação só fica forte quando a documentação e as premissas estão completas.</div>
     <div style={{display:"grid",gap:7}}>
      {motor.cobertura.map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"7px 8px",border:"1px solid #EEF0F4",borderRadius:8,fontSize:9}}>
       <span>{x.nome}</span><b style={{color:x.ok?"#176B47":"#B7791F"}}>{x.ok?"OK":"PENDENTE"}</b>
      </div>)}
     </div>
    </div>
   </div>

   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
    <div style={card}><h3 style={{marginTop:0}}>Riscos principais</h3>{motor.riscos.length?<ol style={{paddingLeft:18,margin:0}}>{motor.riscos.map((x,i)=><li key={i} style={{fontSize:9,lineHeight:1.5,marginBottom:6}}>{x}</li>)}</ol>:<p style={{fontSize:9,color:"#697386"}}>Gere o diagnóstico para mapear riscos.</p>}</div>
    <div style={card}><h3 style={{marginTop:0}}>Oportunidades</h3>{motor.oportunidades.length?<ol style={{paddingLeft:18,margin:0}}>{motor.oportunidades.map((x,i)=><li key={i} style={{fontSize:9,lineHeight:1.5,marginBottom:6}}>{x}</li>)}</ol>:<p style={{fontSize:9,color:"#697386"}}>Gere o diagnóstico para mapear oportunidades.</p>}</div>
    <div style={card}><h3 style={{marginTop:0}}>Próximas decisões</h3>{motor.plano.length?<ol style={{paddingLeft:18,margin:0}}>{motor.plano.map((x,i)=><li key={i} style={{fontSize:9,lineHeight:1.5,marginBottom:6}}>{x}</li>)}</ol>:<p style={{fontSize:9,color:"#697386"}}>O plano de ação aparecerá após a análise da IA.</p>}</div>
   </div>

   <div style={card}>
    <h3 style={{margin:"0 0 4px"}}>Mapa de impacto da Reforma</h3>
    <div style={{fontSize:8.7,color:"#697386",marginBottom:10}}>Baseado na matriz criada pela IA a partir dos documentos e dados confirmados.</div>
    <div style={{display:"grid",gap:8}}>
     {(analise?.matrizImpacto||[]).map((x,i)=>{
      const nivel=String(x.nivel||"NAO_AVALIADO").toUpperCase();
      const valor=nivel==="ALTO"?100:nivel==="MEDIO"?65:nivel==="BAIXO"?30:10;
      const cor=nivel==="ALTO"?"#B42318":nivel==="MEDIO"?"#B7791F":nivel==="BAIXO"?"#176B47":"#98A2B3";
      return <div key={i} style={{display:"grid",gridTemplateColumns:"180px 1fr 95px",gap:8,alignItems:"center"}}>
       <b style={{fontSize:9}}>{x.area}</b>
       <div style={{height:9,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${valor}%`,background:cor,borderRadius:999}}/></div>
       <b style={{fontSize:8.5,textAlign:"right",color:cor}}>{nivel.replace("_"," ")}</b>
      </div>
     })}
     {!analise?.matrizImpacto?.length&&<div style={{fontSize:9,color:"#697386",padding:10,textAlign:"center"}}>Gere o diagnóstico IBS/CBS para preencher o mapa.</div>}
    </div>
   </div>

   <div style={{...card,borderColor:"#C9D7F1",background:"#F8FBFF"}}>
    <b style={{fontSize:10}}>Como este motor funciona</b>
    <p style={{fontSize:9,lineHeight:1.6,color:"#5B667A",marginBottom:0}}>A Finder não usa uma planilha fixa como fonte principal. Os documentos são interpretados pela IA, os dados são levados para os campos editáveis, o cálculo financeiro permanece determinístico e a recomendação cruza documentação, operação real, B2B/B2C, créditos, riscos, impacto e simulação. Se faltar dado, o sistema mantém a recomendação como pendente em vez de inventar.</p>
   </div>
  </div>}

  {aba==="impacto"&&<div style={{display:"grid",gap:9}}>{analise?<>{list("Riscos",analise.riscos)}{list("Oportunidades",analise.oportunidades)}{list("Contratos / ERP / cadastros",analise.adequacoes)}<div style={card}><h3>Matriz de impacto</h3>{(analise.matrizImpacto||[]).map((x,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"160px 80px 1fr",gap:8,padding:"7px 0",borderBottom:"1px solid #EEF0F4",fontSize:9.5}}><b>{x.area}</b><b>{x.nivel}</b><span>{x.diagnostico}</span></div>)}</div></>:<div style={card}>Gere o diagnóstico técnico primeiro.</div>}</div>}

  {aba==="transicao"&&<div style={{display:"grid",gap:10}}>
   <div style={{...card,background:"linear-gradient(135deg,#101B33,#17233D)",color:"#fff",border:0}}>
    <div style={{fontSize:8.5,fontWeight:900,color:"#FFB7A7"}}>TRANSIÇÃO 2026 → 2033</div>
    <h2 style={{margin:"5px 0 5px",fontSize:22}}>Como a Reforma entra na operação ao longo do tempo</h2>
    <p style={{fontSize:9.5,color:"#D8DEEA",lineHeight:1.6,margin:0}}>A transição não acontece de uma vez. A leitura abaixo separa fase de teste, entrada da CBS, substituição progressiva de ICMS/ISS pelo IBS e modelo pleno.</p>
   </div>

   <div style={card}>
    <h3 style={{margin:"0 0 4px"}}>Gráfico — substituição progressiva de ICMS/ISS pelo IBS</h3>
    <div style={{fontSize:8.7,color:"#697386",marginBottom:12}}>Percentuais de transição divulgados oficialmente para 2029–2033. 2027/2028 são mostrados como fase inicial do IBS a 0,1 p.p., não como percentual de substituição.</div>

    <div style={{display:"grid",gap:10}}>
     {transicaoModelo.map((x,i)=>{
      const pctNovo=x.ano==="2027"||x.ano==="2028"?1:x.ibs;
      const pctAnt=x.ano==="2027"||x.ano==="2028"?99:x.antigos;
      return <div key={x.ano} style={{display:"grid",gridTemplateColumns:"55px 110px 1fr",gap:10,alignItems:"center"}}>
       <b style={{fontSize:10}}>{x.ano}</b>
       <span style={{fontSize:8.5,fontWeight:800,color:x.ano==="2033"?"#176B47":"#5B667A"}}>{x.fase}</span>
       <div>
        <div style={{height:16,display:"flex",borderRadius:999,overflow:"hidden",background:"#EEF1F5"}}>
         <div style={{width:`${Math.max(0,pctAnt)}%`,background:"#D8DEEA"}}/>
         <div style={{width:`${Math.max(1,pctNovo)}%`,background:x.ano==="2033"?"#176B47":"#31589C"}}/>
        </div>
        <div style={{fontSize:8,color:"#697386",marginTop:3}}>{x.descricao}</div>
       </div>
      </div>
     })}
    </div>
   </div>

   <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
    <div style={card}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>2026</div><div style={{fontSize:17,fontWeight:900,marginTop:3}}>Ano teste</div><p style={{fontSize:8.5,color:"#697386",lineHeight:1.5}}>CBS 0,9% + IBS 0,1%, observadas compensação/dispensa conforme regras vigentes.</p></div>
    <div style={card}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>2027–2028</div><div style={{fontSize:17,fontWeight:900,marginTop:3}}>CBS + IBS inicial</div><p style={{fontSize:8.5,color:"#697386",lineHeight:1.5}}>PIS/Cofins são extintos; CBS entra em vigor e IBS permanece em fase inicial.</p></div>
    <div style={card}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>2029–2032</div><div style={{fontSize:17,fontWeight:900,marginTop:3}}>Substituição gradual</div><p style={{fontSize:8.5,color:"#697386",lineHeight:1.5}}>IBS cresce progressivamente enquanto ICMS e ISS são reduzidos.</p></div>
    <div style={{...card,borderColor:"#A9DFC5",background:"#F3FBF7"}}><div style={{fontSize:8,fontWeight:900,color:"#176B47"}}>2033</div><div style={{fontSize:17,fontWeight:900,marginTop:3,color:"#176B47"}}>Modelo pleno</div><p style={{fontSize:8.5,color:"#4A6B5B",lineHeight:1.5}}>Novo modelo integral e extinção de ICMS/ISS.</p></div>
   </div>

   <div style={card}>
    <h3 style={{margin:"0 0 8px"}}>Impacto financeiro — cenário atual x modelo simulado</h3>
    {simulacao?<div style={{display:"grid",gap:9}}>
     {[
      ["DAS / carga atual usada na comparação",comparativoRelatorio.dentro,"#31589C"],
      ["DAS residual estimado por fora",comparativoRelatorio.residual||0,"#8A94A6"],
      ["IBS + CBS simulado",comparativoRelatorio.ibscbs,"#FF6B4A"],
      ["Total Simples por fora",comparativoRelatorio.fora||0,"#17233D"]
     ].map(([label,v,cor],i)=>{
      const max=Math.max(comparativoRelatorio.dentro,comparativoRelatorio.fora||0,comparativoRelatorio.ibscbs,1);
      return <div key={i} style={{display:"grid",gridTemplateColumns:"210px 1fr 120px",gap:8,alignItems:"center",fontSize:9}}>
       <b>{label}</b>
       <div style={{height:13,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(2,(n(v)/max)*100)}%`,background:cor,borderRadius:999}}/></div>
       <b style={{textAlign:"right"}}>{moedaMotor(v)}</b>
      </div>
     })}
    </div>:<div style={{padding:18,textAlign:"center",fontSize:9,color:"#697386"}}>Execute a simulação para projetar o impacto financeiro.</div>}
   </div>

   <div style={card}>
    <h3 style={{margin:"0 0 4px"}}>Providências por fase</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginTop:10}}>
     <div style={{border:"1px solid #E3E7EF",borderRadius:10,padding:10}}><b style={{fontSize:10}}>Agora / 2026</b><ul style={{paddingLeft:16,fontSize:8.8,lineHeight:1.6}}><li>Validar documentos e cadastros fiscais.</li><li>Revisar ERP/NFS-e/NF-e e campos IBS/CBS.</li><li>Medir B2B/B2C, créditos e margem.</li><li>Definir estratégia do Simples para 2027 quando aplicável.</li></ul></div>
     <div style={{border:"1px solid #E3E7EF",borderRadius:10,padding:10}}><b style={{fontSize:10}}>2027–2028</b><ul style={{paddingLeft:16,fontSize:8.8,lineHeight:1.6}}><li>Acompanhar CBS e IBS inicial.</li><li>Recalcular preços e contratos.</li><li>Controlar créditos e documentos dos fornecedores.</li><li>Comparar Simples dentro x por fora periodicamente.</li></ul></div>
     <div style={{border:"1px solid #E3E7EF",borderRadius:10,padding:10}}><b style={{fontSize:10}}>2029–2033</b><ul style={{paddingLeft:16,fontSize:8.8,lineHeight:1.6}}><li>Recalcular a carga a cada degrau da transição.</li><li>Acompanhar redução ICMS/ISS e crescimento IBS.</li><li>Atualizar preço, margem e contratos.</li><li>Revalidar benefícios e regimes específicos.</li></ul></div>
    </div>
   </div>

   {analise&&list("Marcos e providências identificados pela IA",analise.transicao)}

   <div style={{...card,background:"#F8FBFF",borderColor:"#C9D7F1"}}>
    <b style={{fontSize:9.5}}>Base de atualização</b>
    <p style={{fontSize:8.6,lineHeight:1.55,color:"#5B667A",marginBottom:0}}>A linha do tempo considera o cronograma oficial vigente na data desta versão. Alíquotas de referência, reduções setoriais, regras do Simples e atos regulamentares devem continuar sendo validados antes de uma recomendação definitiva.</p>
   </div>
  </div>}

  {aba==="relatorio"&&<div style={{display:"grid",gap:10}}>
   <div style={{...card,background:"linear-gradient(135deg,#101B33,#17233D)",color:"#fff",border:0,padding:20}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"start",flexWrap:"wrap"}}>
     <div>
      <div style={{fontSize:8.5,fontWeight:900,color:"#FFB7A7"}}>FINDER INTELLIGENCE · LAUDO GERENCIAL DA REFORMA TRIBUTÁRIA</div>
      <h2 style={{margin:"5px 0 3px",fontSize:24}}>{empresa?.razaoSocial||empresa?.razao_social||"Cliente"}</h2>
      <div style={{fontSize:9,color:"#D8DEEA"}}>CNPJ {digits(cnpj)||"-"} · {regime||"Regime não informado"} · {municipio||"-"}/{uf||"-"}</div>
     </div>
     <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
      <span style={{background:`${corRisco}33`,border:`1px solid ${corRisco}`,borderRadius:999,padding:"6px 9px",fontSize:8,fontWeight:900}}>RISCO {motor.risco}</span>
      <button onClick={()=>salvar(analise?"DIAGNOSTICO_GERADO":"EM_ANALISE")} style={{padding:"9px 12px",borderRadius:8,fontWeight:900}}>Salvar inteligência</button>
     </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8,marginTop:15}}>
     {[
      ["Cobertura da análise",`${motor.coberturaPct}%`],
      ["DAS atual",moedaMotor(comparativoRelatorio.dentro)],
      ["DAS residual por fora",comparativoRelatorio.residual==null?"Pendente":moedaMotor(comparativoRelatorio.residual)],
      ["IBS + CBS",simulacao?moedaMotor(comparativoRelatorio.ibscbs):"Pendente"],
      ["Total por fora",comparativoRelatorio.fora==null?"Pendente":moedaMotor(comparativoRelatorio.fora)]
     ].map(([a,b],i)=><div key={i} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:10}}>
      <div style={{fontSize:7.5,color:"#BFC8D8",fontWeight:900,textTransform:"uppercase"}}>{a}</div><div style={{fontSize:15,fontWeight:900,marginTop:4}}>{b}</div>
     </div>)}
    </div>
   </div>

   <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:10}}>
    <div style={card}>
     <div style={{fontSize:8,fontWeight:900,color:"#FF6B4A"}}>CONCLUSÃO EXECUTIVA</div>
     <h2 style={{fontSize:18,margin:"5px 0"}}>{motor.recomendacao}</h2>
     <p style={{fontSize:9.5,lineHeight:1.65,color:"#4B5565"}}>{motor.explicacao}</p>
     {analise?.resumo&&<div style={{marginTop:10,padding:"10px 11px",background:"#F7F9FC",borderRadius:9,fontSize:9.2,lineHeight:1.65}}>{analise.resumo}</div>}
    </div>

    <div style={card}>
     <h3 style={{margin:"0 0 8px"}}>Qualidade da base</h3>
     <div style={{display:"grid",gap:6}}>
      {motor.cobertura.map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:8.8,padding:"6px 7px",borderBottom:"1px solid #EEF0F4"}}><span>{x.nome}</span><b style={{color:x.ok?"#176B47":"#B7791F"}}>{x.ok?"OK":"PENDENTE"}</b></div>)}
     </div>
    </div>
   </div>

   <div style={card}>
    <h3 style={{margin:"0 0 4px"}}>Gráfico — cenário atual x Simples por fora</h3>
    <div style={{fontSize:8.7,color:"#697386",marginBottom:11}}>O cenário por fora soma o DAS residual estimado à apuração regular simulada de IBS/CBS.</div>
    {simulacao?<div style={{display:"grid",gap:10}}>
     {[
      ["DAS atual / dentro",comparativoRelatorio.dentro,"#31589C"],
      ["DAS residual por fora",comparativoRelatorio.residual||0,"#8A94A6"],
      ["IBS/CBS por fora",comparativoRelatorio.ibscbs,"#FF6B4A"],
      ["Total por fora",comparativoRelatorio.fora||0,"#17233D"]
     ].map(([label,v,cor],i)=>{
      const max=Math.max(comparativoRelatorio.dentro,comparativoRelatorio.fora||0,comparativoRelatorio.ibscbs,1);
      return <div key={i} style={{display:"grid",gridTemplateColumns:"190px 1fr 115px",gap:8,alignItems:"center",fontSize:9}}>
       <b>{label}</b><div style={{height:14,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(2,(n(v)/max)*100)}%`,background:cor,borderRadius:999}}/></div><b style={{textAlign:"right"}}>{moedaMotor(v)}</b>
      </div>
     })}
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:5}}>
      <div style={{padding:10,background:"#F7F9FC",borderRadius:9}}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>DIFERENÇA</div><div style={{fontSize:17,fontWeight:900,color:comparativoRelatorio.diff>0?"#B42318":"#176B47"}}>{comparativoRelatorio.diff==null?"Pendente":moedaMotor(comparativoRelatorio.diff)}</div></div>
      <div style={{padding:10,background:"#F7F9FC",borderRadius:9}}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>VARIAÇÃO</div><div style={{fontSize:17,fontWeight:900}}>{comparativoRelatorio.pctDiff==null?"Pendente":`${comparativoRelatorio.pctDiff.toFixed(2)}%`}</div></div>
      <div style={{padding:10,background:"#F7F9FC",borderRadius:9}}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>MENOR CARGA MATEMÁTICA</div><div style={{fontSize:17,fontWeight:900}}>{simulacao.simples?.menorCargaMatematica==="NAO_CALCULAVEL"?"Pendente":simulacao.simples?.menorCargaMatematica||"-"}</div></div>
     </div>
    </div>:<div style={{padding:18,textAlign:"center",fontSize:9,color:"#697386"}}>Execute a simulação para preencher este comparativo.</div>}
   </div>

   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
    <div style={card}>
     <h3 style={{margin:"0 0 8px"}}>Composição tributária encontrada</h3>
     {(()=>{
      const tr=extracao?.tributos||{};
      const itens=[
       ["PIS",n(tr.pis)],["COFINS",n(tr.cofins)],["ISS",n(tr.iss)],["ICMS",n(tr.icms)],
       ["CPP",n(tr.cpp)],["IRPJ",n(tr.irpj)],["CSLL",n(tr.csll)],["IPI",n(tr.ipi)],["Outros",n(tr.outros)]
      ].filter(x=>x[1]>0);
      const max=Math.max(...itens.map(x=>x[1]),1);
      return itens.length?<div style={{display:"grid",gap:7}}>{itens.map(([nome,v],i)=><div key={i} style={{display:"grid",gridTemplateColumns:"75px 1fr 105px",gap:7,alignItems:"center",fontSize:8.8}}><b>{nome}</b><div style={{height:10,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${v/max*100}%`,background:"#31589C"}}/></div><b style={{textAlign:"right"}}>{moedaMotor(v)}</b></div>)}</div>:<div style={{fontSize:9,color:"#697386"}}>A composição detalhada não foi encontrada nos documentos.</div>
     })()}
    </div>

    <div style={card}>
     <h3 style={{margin:"0 0 8px"}}>Perfil comercial e crédito</h3>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <div style={{padding:12,background:"#F7F9FC",borderRadius:9}}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>B2B</div><div style={{fontSize:20,fontWeight:900}}>{n(b2b).toFixed(1)}%</div><div style={{height:8,background:"#E7EBF2",borderRadius:999,overflow:"hidden",marginTop:6}}><div style={{width:`${Math.min(100,n(b2b))}%`,height:"100%",background:"#17233D"}}/></div></div>
      <div style={{padding:12,background:"#F7F9FC",borderRadius:9}}><div style={{fontSize:8,fontWeight:900,color:"#697386"}}>B2C</div><div style={{fontSize:20,fontWeight:900}}>{n(b2c).toFixed(1)}%</div><div style={{height:8,background:"#E7EBF2",borderRadius:999,overflow:"hidden",marginTop:6}}><div style={{width:`${Math.min(100,n(b2c))}%`,height:"100%",background:"#FF6B4A"}}/></div></div>
     </div>
     <p style={{fontSize:8.7,color:"#697386",lineHeight:1.55}}>O peso B2B/B2C deve entrar na decisão porque crédito para clientes PJ, capacidade de repasse e sensibilidade de preço podem mudar a melhor estratégia.</p>
    </div>
   </div>

   <div style={card}>
    <h3 style={{margin:"0 0 8px"}}>Gráfico — trajetória da transição</h3>
    <div style={{display:"grid",gap:8}}>
     {transicaoModelo.map((x,i)=>{
      const novo=x.ano==="2027"||x.ano==="2028"?1:x.ibs;
      const antigo=x.ano==="2027"||x.ano==="2028"?99:x.antigos;
      return <div key={i} style={{display:"grid",gridTemplateColumns:"55px 1fr 100px",gap:8,alignItems:"center",fontSize:8.8}}>
       <b>{x.ano}</b>
       <div style={{height:12,display:"flex",borderRadius:999,overflow:"hidden",background:"#EEF1F5"}}><div style={{width:`${antigo}%`,background:"#D8DEEA"}}/><div style={{width:`${Math.max(1,novo)}%`,background:x.ano==="2033"?"#176B47":"#31589C"}}/></div>
       <span style={{textAlign:"right",fontWeight:800}}>{x.fase}</span>
      </div>
     })}
    </div>
   </div>

   {analise&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
    <div style={card}><h3 style={{marginTop:0}}>Riscos</h3><ol style={{paddingLeft:17,margin:0}}>{(analise.riscos||[]).slice(0,7).map((x,i)=><li key={i} style={{fontSize:8.8,lineHeight:1.55,marginBottom:5}}>{x}</li>)}</ol></div>
    <div style={card}><h3 style={{marginTop:0}}>Oportunidades</h3><ol style={{paddingLeft:17,margin:0}}>{(analise.oportunidades||[]).slice(0,7).map((x,i)=><li key={i} style={{fontSize:8.8,lineHeight:1.55,marginBottom:5}}>{x}</li>)}</ol></div>
    <div style={card}><h3 style={{marginTop:0}}>Plano de ação</h3><ol style={{paddingLeft:17,margin:0}}>{(analise.planoAcao||[]).slice(0,8).map((x,i)=><li key={i} style={{fontSize:8.8,lineHeight:1.55,marginBottom:5}}>{x}</li>)}</ol></div>
   </div>}

   {analise?.matrizImpacto?.length>0&&<div style={card}>
    <h3 style={{margin:"0 0 8px"}}>Mapa de impacto empresarial</h3>
    <div style={{display:"grid",gap:7}}>
     {analise.matrizImpacto.map((x,i)=>{
      const nivel=String(x.nivel||"NAO_AVALIADO").toUpperCase();
      const valor=nivel==="ALTO"?100:nivel==="MEDIO"?65:nivel==="BAIXO"?30:10;
      const cor=nivel==="ALTO"?"#B42318":nivel==="MEDIO"?"#B7791F":nivel==="BAIXO"?"#176B47":"#98A2B3";
      return <div key={i} style={{display:"grid",gridTemplateColumns:"180px 1fr 90px",gap:8,alignItems:"center",fontSize:8.8}}><b>{x.area}</b><div style={{height:10,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${valor}%`,background:cor}}/></div><b style={{color:cor,textAlign:"right"}}>{nivel.replace("_"," ")}</b></div>
     })}
    </div>
   </div>}

   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
    {analise&&<div style={card}><h3 style={{marginTop:0}}>Base legal / fundamentação</h3><ol style={{paddingLeft:17,margin:0}}>{(analise.fundamentacao||[]).map((x,i)=><li key={i} style={{fontSize:8.7,lineHeight:1.55,marginBottom:5}}>{x}</li>)}</ol></div>}
    <div style={{...card,background:"#FFF8E7",borderColor:"#F3D99B"}}>
     <h3 style={{marginTop:0,color:"#805B10"}}>Premissas e ressalvas</h3>
     <ul style={{paddingLeft:17,fontSize:8.7,lineHeight:1.6,color:"#6E551C"}}>
      <li>O DAS residual por fora é uma estimativa gerencial baseada na composição documental atual quando disponível.</li>
      <li>Alíquotas, reduções, benefícios e regimes específicos devem ser validados com a legislação vigente na data da decisão.</li>
      <li>A recomendação considera a base disponível; documentos faltantes reduzem a confiança.</li>
      <li>A comparação Presumido x Real x Simples continua pertencendo ao Planejamento Tributário.</li>
     </ul>
    </div>
   </div>
  </div>}
 </div>
}

export default function Tributario({
  token,
}) {
  const [
    tela,
    setTela,
  ] = useState("inicio");

  const [
    tipoProjeto,
    setTipoProjeto,
  ] = useState("");

  const [
    estrutura,
    setEstrutura,
  ] = useState("empresa");

  const [
    modalidade,
    setModalidade,
  ] = useState("hibrido");

  const [
    empresas,
    setEmpresas,
  ] = useState([
    novaEmpresa(),
  ]);

  const [
    arquivos,
    setArquivos,
  ] = useState([]);

  const [
    dadosManuais,
    setDadosManuais,
  ] = useState({});

  const [
    dadosProjeto,
    setDadosProjeto,
  ] = useState({
    responsavelFinder: "",
    origemCliente: "",
    contatoNome: "",
    contatoEmail: "",
    contatoTelefone: "",
    observacaoOrigem: "",
  });


  const [
    atividadesSelecionadas,
    setAtividadesSelecionadas,
  ] = useState([]);

  const [
    atividadePrincipalSelecionada,
    setAtividadePrincipalSelecionada,
  ] = useState("");

  const [
    descricaoAtividadeCliente,
    setDescricaoAtividadeCliente,
  ] = useState("");

  const [
    historicoProjeto,
    setHistoricoProjeto,
  ] = useState([]);

  const [
    projetoId,
    setProjetoId,
  ] = useState(() => {
    try {
      return (
        crypto?.randomUUID?.() ||
        `tax_${Date.now()}_${Math.random()}`
      );
    } catch {
      return `tax_${Date.now()}_${Math.random()}`;
    }
  });

  const [
    abaAnalise,
    setAbaAnalise,
  ] = useState("resumo");

  const [
    diagnosticoGerado,
    setDiagnosticoGerado,
  ] = useState(null);

  const [
    gerandoDiagnostico,
    setGerandoDiagnostico,
  ] = useState(false);

  const [
    diagnosticoOrigem,
    setDiagnosticoOrigem,
  ] = useState("");

  const [
    arquivosProcessadosIa,
    setArquivosProcessadosIa,
  ] = useState([]);

  const [
    progressoIa,
    setProgressoIa,
  ] = useState({
    etapa: "",
    atual: 0,
    total: 0,
    mensagem: "",
  });

  const [
    projetosSalvos,
    setProjetosSalvos,
  ] = useState([]);

  const [
    carregandoProjetos,
    setCarregandoProjetos,
  ] = useState(false);

  const [
    projetoAberto,
    setProjetoAberto,
  ] = useState(null);

  const [
    filtroHistorico,
    setFiltroHistorico,
  ] = useState({
    busca: "",
    tipo: "",
    responsavel: "",
    status: "",
    arquivamento: "ATIVOS",
  });

  const [
    versaoDiagnostico,
    setVersaoDiagnostico,
  ] = useState(null);

  const [
    erro,
    setErro,
  ] = useState("");

  const empresasConsultadas =
    useMemo(
      () =>
        empresas.filter(
          (e) =>
            e.dados
        ).length,
      [empresas]
    );

  function formatarDataHora(
    valor
  ) {
    try {
      return new Date(
        valor
      ).toLocaleString(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "short",
        }
      );
    } catch {
      return String(
        valor || "-"
      );
    }
  }

  function registrarHistorico(
    tipo,
    descricao,
    detalhes = {}
  ) {
    const evento = {
      id:
        crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random()}`,
      tipo,
      descricao,
      detalhes,
      criadoEm:
        new Date().toISOString(),
    };

    setHistoricoProjeto(
      (atuais) => {
        const novos = [
          evento,
          ...atuais,
        ];

        try {
          localStorage.setItem(
            `finder_tax_history_${projetoId}`,
            JSON.stringify(
              novos
            )
          );
        } catch {}

        return novos;
      }
    );
  }

  function alterarDadosProjeto(
    campo,
    valor
  ) {
    setDadosProjeto(
      (atual) => ({
        ...atual,
        [campo]: valor,
      })
    );
  }

  async function apiTributarioJson(
    action,
    {
      method = "GET",
      body = null,
      query = {},
    } = {}
  ) {
    const params =
      new URLSearchParams({
        action,
      });

    Object.entries(
      query || {}
    ).forEach(
      ([chave, valor]) => {
        if (
          valor !== "" &&
          valor !== null &&
          valor !== undefined
        ) {
          params.set(
            chave,
            String(valor)
          );
        }
      }
    );

    const resposta =
      await fetch(
        `/api/tributario?${params.toString()}`,
        {
          method,
          headers: {
            ...(body
              ? {
                  "content-type":
                    "application/json",
                }
              : {}),
            ...(token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {}),
          },
          ...(body
            ? {
                body:
                  JSON.stringify(
                    body
                  ),
              }
            : {}),
        }
      );

    const data =
      await resposta
        .json()
        .catch(
          () => null
        );

    if (
      !resposta.ok ||
      !data?.sucesso
    ) {
      throw new Error(
        data?.error ||
        "Erro no módulo tributário."
      );
    }

    return data;
  }

  function normalizarRespostaCnpj(
    data
  ) {
    if (
      !data ||
      data.sucesso !== true
    ) {
      throw new Error(
        data?.error ||
        "A consulta do CNPJ não retornou dados válidos."
      );
    }

    const cnaePrincipal =
      data.cnaePrincipal ||
      data.cnae?.principal || {
        codigo:
          String(
            data.cnae?.codigo ||
            ""
          ),
        descricao:
          data.cnae?.descricao ||
          "",
        principal: true,
      };

    const cnaesSecundarios =
      Array.isArray(
        data.cnaesSecundarios
      )
        ? data.cnaesSecundarios
        : Array.isArray(
            data.cnae?.secundarios
          )
        ? data.cnae.secundarios
        : [];

    const todosCnaes =
      Array.isArray(
        data.todosCnaes
      ) &&
      data.todosCnaes.length
        ? data.todosCnaes
        : Array.isArray(
            data.cnae?.todos
          ) &&
          data.cnae.todos.length
        ? data.cnae.todos
        : [
            cnaePrincipal,
            ...cnaesSecundarios,
          ];

    return {
      cnpj:
        data.cnpj ||
        "",
      razaoSocial:
        data.razaoSocial ||
        data.razao ||
        data.nomeEmpresarial ||
        data.nome ||
        "",
      nomeFantasia:
        data.nomeFantasia ||
        "",
      situacao:
        data.situacao ||
        data.situacaoCadastral ||
        "",
      porte:
        data.porte ||
        "",
      municipio:
        data.municipio ||
        data.endereco?.municipio ||
        "",
      uf:
        data.uf ||
        data.endereco?.uf ||
        "",
      endereco:
        data.endereco ||
        {},
      cnaePrincipal,
      cnaesSecundarios,
      todosCnaes,
      dadosBrutos:
        data,
    };
  }

  async function arquivoParaDataUrl(
    arquivo
  ) {
    return await new Promise(
      (
        resolve,
        reject
      ) => {
        const reader =
          new FileReader();

        reader.onload =
          () =>
            resolve(
              reader.result
            );

        reader.onerror =
          () =>
            reject(
              new Error(
                `Não foi possível ler ${arquivo.name}.`
              )
            );

        reader.readAsDataURL(
          arquivo
        );
      }
    );
  }

  function atividadePrincipalRealAtual() {
    return (
      atividadesSelecionadas.find(
        (item) =>
          chaveAtividade(
            item
          ) ===
          atividadePrincipalSelecionada
      ) ||
      null
    );
  }

  function payloadProjetoAtual() {
    return {
      id:
        projetoId,

      tipoProjeto,

      estrutura,

      modalidade,

      responsavelFinder:
        dadosProjeto.responsavelFinder ||
        "",

      origemCliente:
        dadosProjeto.origemCliente ||
        "",

      contatoNome:
        dadosProjeto.contatoNome ||
        "",

      contatoEmail:
        dadosProjeto.contatoEmail ||
        "",

      contatoTelefone:
        dadosProjeto.contatoTelefone ||
        "",

      observacaoOrigem:
        dadosProjeto.observacaoOrigem ||
        "",

      empresas:
        empresas
          .filter(
            (empresa) =>
              empresa.dados
          )
          .map(
            (empresa) => ({
              cnpj:
                empresa.dados.cnpj ||
                empresa.cnpj ||
                "",
              razaoSocial:
                empresa.dados.razaoSocial ||
                "",
              nomeFantasia:
                empresa.dados.nomeFantasia ||
                "",
              situacao:
                empresa.dados.situacao ||
                "",
              porte:
                empresa.dados.porte ||
                "",
              municipio:
                empresa.dados.municipio ||
                "",
              uf:
                empresa.dados.uf ||
                "",
              cnaePrincipal:
                empresa.dados.cnaePrincipal ||
                null,
              cnaesSecundarios:
                empresa.dados.cnaesSecundarios ||
                [],
            })
          ),

      atividades: {
        selecionadas:
          atividadesSelecionadas,
        principalReal:
          atividadePrincipalRealAtual(),
        descricaoReal:
          descricaoAtividadeCliente.trim(),
      },

      dadosManuais,
    };
  }

  async function salvarProjetoAtual(
    status = "EM_ANALISE"
  ) {
    return await apiTributarioJson(
      "salvar-projeto",
      {
        method: "POST",
        body: {
          ...payloadProjetoAtual(),
          status,
        },
      }
    );
  }

  async function carregarProjetosSalvos() {
    setCarregandoProjetos(
      true
    );

    try {
      const data =
        await apiTributarioJson(
          "listar-projetos",
          {
            query: {
              busca:
                filtroHistorico.busca,
              tipo:
                filtroHistorico.tipo,
              responsavel:
                filtroHistorico.responsavel,
              status:
                filtroHistorico.status,
              arquivamento:
                filtroHistorico.arquivamento,
            },
          }
        );

      setProjetosSalvos(
        Array.isArray(
          data.projetos
        )
          ? data.projetos
          : []
      );
    } catch (
      error
    ) {
      console.error(
        "[tributario][historico]",
        error
      );
    } finally {
      setCarregandoProjetos(
        false
      );
    }
  }

  async function abrirProjetoSalvo(
    id
  ) {
    setCarregandoProjetos(
      true
    );

    try {
      const data =
        await apiTributarioJson(
          "obter-projeto",
          {
            query: {
              id,
            },
          }
        );

      setProjetoAberto(
        data.projeto
      );

      setTela(
        "projeto-salvo"
      );
    } catch (
      error
    ) {
      setErro(
        error?.message ||
        "Não foi possível abrir o diagnóstico."
      );
    } finally {
      setCarregandoProjetos(
        false
      );
    }
  }

  async function validarProjetoSalvo(
    id
  ) {
    try {
      await apiTributarioJson(
        "validar-projeto",
        {
          method: "POST",
          body: {
            id,
          },
        }
      );

      await abrirProjetoSalvo(
        id
      );

      await carregarProjetosSalvos();
    } catch (
      error
    ) {
      setErro(
        error?.message ||
        "Não foi possível validar o diagnóstico."
      );
    }
  }

  async function editarProjetoSalvo(id) {
    setErro("");
    setCarregandoProjetos(true);

    try {
      const data = await apiTributarioJson("obter-projeto", {
        query: { id },
      });

      const p = data.projeto;
      if (!p) throw new Error("Projeto não encontrado.");

      setProjetoId(p.id);
      setTipoProjeto(p.tipoProjeto || "planejamento");
      setModalidade(p.modalidade || "manual");
      setDadosProjeto((atual) => ({
        ...atual,
        responsavelFinder: p.responsavelFinder || "",
        origemCliente: p.origemCliente || "",
        contatoNome: p.contatoNome || "",
        contatoEmail: p.contatoEmail || "",
        contatoTelefone: p.contatoTelefone || "",
        observacaoOrigem: p.observacaoOrigem || "",
      }));

      if (Array.isArray(p.empresas) && p.empresas.length) {
        setEmpresas(
          p.empresas.map((empresa, index) => ({
            id: empresa.id || `empresa_${index}_${Date.now()}`,
            cnpj: empresa.cnpj || "",
            dados: empresa.dados || empresa,
            carregando: false,
            erro: "",
          }))
        );
      }

      const at = p.atividades || {};
      setAtividadesSelecionadas(
        Array.isArray(at.selecionadas) ? at.selecionadas : []
      );
      setAtividadePrincipalSelecionada(at.principalReal || "");
      setDescricaoAtividadeCliente(at.descricaoReal || "");

      const manuais = p.dadosManuais || {};
      if (manuais.planejamentoV2 && p.tipoProjeto === "planejamento") {
        // O Planejamento V2 salva sua própria base e será reaberto mantendo o mesmo projetoId.
        setTela("planejamento-v2");
      } else {
        setDadosManuais((atual) => ({
          ...atual,
          ...manuais,
        }));
        setTela("configuracao");
      }

      setProjetoAberto(null);
    } catch (error) {
      setErro(error?.message || "Não foi possível editar a inteligência tributária.");
    } finally {
      setCarregandoProjetos(false);
    }
  }

  async function arquivarProjetoSalvo(id, arquivado = true) {
    setErro("");
    try {
      await apiTributarioJson("arquivar-projeto", {
        method: "POST",
        body: { id, arquivado },
      });

      if (projetoAberto?.id === id) {
        setProjetoAberto((atual) =>
          atual ? { ...atual, arquivado } : atual
        );
      }

      await carregarProjetosSalvos();
    } catch (error) {
      setErro(error?.message || "Não foi possível alterar o arquivamento.");
    }
  }

  async function excluirProjetoSalvo(id, nome = "esta inteligência tributária") {
    const confirmou = window.confirm(
      `Excluir definitivamente ${nome}?\\n\\nEsta ação excluirá o projeto, diagnósticos, versões e histórico. Não poderá ser desfeita.`
    );

    if (!confirmou) return;

    const segundaConfirmacao = window.prompt(
      'Para confirmar a exclusão definitiva, digite EXCLUIR'
    );

    if (segundaConfirmacao !== "EXCLUIR") return;

    setErro("");
    try {
      await apiTributarioJson("excluir-projeto", {
        method: "POST",
        body: { id, confirmacao: "EXCLUIR" },
      });

      if (projetoAberto?.id === id) {
        setProjetoAberto(null);
        setTela("inicio");
      }

      await carregarProjetosSalvos();
    } catch (error) {
      setErro(error?.message || "Não foi possível excluir a inteligência tributária.");
    }
  }

  async function gerarDiagnosticoIaReal() {
    setErro("");

    if (
      modalidade !==
        "manual" &&
      !arquivos.length
    ) {
      setErro(
        "Selecione pelo menos um documento para a análise com IA."
      );
      return;
    }

    if (
      atividadesDisponiveis.length &&
      !atividadesSelecionadas.length
    ) {
      setErro(
        "Selecione as atividades/CNAEs realmente exercidas."
      );
      return;
    }

    if (
      atividadesSelecionadas.length &&
      !atividadePrincipalSelecionada
    ) {
      setErro(
        "Defina a atividade principal real."
      );
      return;
    }

    if (
      !descricaoAtividadeCliente
        .trim()
    ) {
      setErro(
        "Descreva brevemente o que a empresa realmente faz."
      );
      return;
    }

    setGerandoDiagnostico(
      true
    );

    setDiagnosticoOrigem(
      ""
    );

    try {
      await salvarProjetoAtual(
        "PROCESSANDO_IA"
      );

      const arquivosIa =
        [];

      for (
        let i = 0;
        i <
        arquivos.length;
        i += 1
      ) {
        const arquivo =
          arquivos[i];

        setProgressoIa({
          etapa:
            "UPLOAD",
          atual:
            i + 1,
          total:
            arquivos.length,
          mensagem:
            `Enviando ${arquivo.name} para leitura da IA...`,
        });

        const fileData =
          await arquivoParaDataUrl(
            arquivo
          );

        const upload =
          await apiTributarioJson(
            "upload-file",
            {
              method: "POST",
              body: {
                filename:
                  arquivo.name,
                mimeType:
                  arquivo.type ||
                  "application/octet-stream",
                fileData,
              },
            }
          );

        arquivosIa.push({
          fileId:
            upload.fileId,
          filename:
            arquivo.name,
          bytes:
            arquivo.size,
        });
      }

      setArquivosProcessadosIa(
        arquivosIa
      );

      setProgressoIa({
        etapa:
          "ANALISE",
        atual:
          arquivos.length,
        total:
          arquivos.length ||
          1,
        mensagem:
          tipoProjeto ===
          "reforma"
            ? "Analisando Reforma Tributária: IBS, CBS, transição, créditos e impacto operacional..."
            : "Analisando Planejamento Tributário: regime atual, eficiência e redução legal de carga...",
      });

      const payload =
        payloadProjetoAtual();

      const respostaIa =
        await apiTributarioJson(
          "diagnostico",
          {
            method: "POST",
            body: {
              tipoProjeto:
                payload.tipoProjeto,
              estrutura:
                payload.estrutura,
              modalidade:
                payload.modalidade,

              cliente: {
                responsavelFinder:
                  payload.responsavelFinder,
                origemCliente:
                  payload.origemCliente,
                contatoNome:
                  payload.contatoNome,
                contatoEmail:
                  payload.contatoEmail,
                contatoTelefone:
                  payload.contatoTelefone,
                observacaoOrigem:
                  payload.observacaoOrigem,
              },

              empresas:
                payload.empresas,

              atividades:
                payload.atividades,

              dadosManuais:
                payload.dadosManuais,

              arquivos:
                arquivosIa,
            },
          }
        );

      const salvo =
        await apiTributarioJson(
          "salvar-diagnostico",
          {
            method: "POST",
            body: {
              projetoId,
              tipoProjeto,
              diagnostico:
                respostaIa.diagnostico,
              modelo:
                respostaIa.modelo ||
                "gpt-5.6",
              usage:
                respostaIa.usage ||
                null,
              documentos:
                arquivosIa,
            },
          }
        );

      setVersaoDiagnostico(
        salvo.versao ||
        null
      );

      setDiagnosticoGerado(
        respostaIa.diagnostico
      );

      setDiagnosticoOrigem(
        "IA_REAL"
      );

      registrarHistorico(
        "DIAGNOSTICO_IA_REAL",
        `Diagnóstico V${
          salvo.versao ||
          ""
        } gerado e salvo.`,
        {
          tipoProjeto,
          documentos:
            arquivosIa.length,
        }
      );

      setProgressoIa({
        etapa:
          "CONCLUIDO",
        atual:
          arquivos.length,
        total:
          arquivos.length ||
          1,
        mensagem:
          "Diagnóstico concluído e salvo no histórico.",
      });

      setAbaAnalise(
        "diagnostico"
      );

      await carregarProjetosSalvos();
    } catch (
      error
    ) {
      console.error(
        "[tributario][IA]",
        error
      );

      setErro(
        error?.message ||
        "Não foi possível concluir a análise com IA."
      );

      setProgressoIa({
        etapa:
          "ERRO",
        atual:
          0,
        total:
          0,
        mensagem:
          error?.message ||
          "Erro no diagnóstico.",
      });
    } finally {
      setGerandoDiagnostico(
        false
      );
    }
  }

  const responsaveisHistorico =
    useMemo(
      () =>
        Array.from(
          new Set(
            projetosSalvos
              .map(
                (item) =>
                  item.responsavelFinder
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        ),
      [projetosSalvos]
    );

  useEffect(
    () => {
      if (
        tela ===
        "inicio"
      ) {
        carregarProjetosSalvos();
      }
    },
    [tela]
  );

  function numeroSeguro(
    valor
  ) {
    const texto =
      String(
        valor ?? ""
      )
        .replace(/\./g, "")
        .replace(",", ".");

    const numero =
      Number(texto);

    return Number.isFinite(numero)
      ? numero
      : 0;
  }

  function gerarDiagnosticoPreliminarLocal() {
    setGerandoDiagnostico(
      true
    );

    try {
      const faturamento =
        numeroSeguro(
          dadosManuais.faturamento12m
        );

      const folha =
        numeroSeguro(
          dadosManuais.folha12m
        );

      const compras =
        numeroSeguro(
          dadosManuais.compras12m
        );

      const despesas =
        numeroSeguro(
          dadosManuais.despesasDedutiveis
        );

      const b2b =
        numeroSeguro(
          dadosManuais.percentualB2B
        );

      const margem =
        numeroSeguro(
          dadosManuais.margemOperacional
        );

      const fatorFolha =
        faturamento > 0
          ? folha / faturamento
          : null;

      const indiceCompras =
        faturamento > 0
          ? compras / faturamento
          : null;

      const indiceDespesas =
        faturamento > 0
          ? despesas / faturamento
          : null;

      const pontos = [];
      const riscos = [];
      const oportunidades = [];
      const dadosFaltantes = [];

      if (!faturamento) {
        dadosFaltantes.push(
          "Faturamento dos últimos 12 meses"
        );
      }

      if (!folha) {
        dadosFaltantes.push(
          "Folha e pró-labore dos últimos 12 meses"
        );
      }

      if (!dadosManuais.regimeAtual) {
        dadosFaltantes.push(
          "Regime tributário atual"
        );
      }

      const atividadePrincipalReal =
        atividadesSelecionadas.find(
          (item) =>
            chaveAtividade(
              item
            ) ===
            atividadePrincipalSelecionada
        ) ||
        null;

      if (
        atividadePrincipalReal
      ) {
        pontos.push(
          `Atividade principal considerada na análise: ${
            atividadePrincipalReal.codigo ||
            ""
          } · ${
            atividadePrincipalReal.descricao ||
            ""
          }.`
        );
      }

      if (
        atividadesSelecionadas.length >
        1
      ) {
        pontos.push(
          `Foram selecionadas ${atividadesSelecionadas.length} atividades/CNAEs para cruzamento tributário.`
        );
      }

      if (
        descricaoAtividadeCliente
          .trim()
      ) {
        pontos.push(
          `Operação informada pelo consultor/cliente: ${descricaoAtividadeCliente.trim()}`
        );
      }

      if (tipoProjeto === "planejamento") {
        if (
          fatorFolha !== null &&
          fatorFolha >= 0.28
        ) {
          oportunidades.push(
            "A relação folha/faturamento está em faixa relevante para análise de Fator R, quando aplicável à atividade."
          );
        }

        if (
          indiceDespesas !== null &&
          indiceDespesas >= 0.20
        ) {
          oportunidades.push(
            "O volume de despesas informado merece comparação detalhada com Lucro Real, pois pode alterar a eficiência tributária."
          );
        }

        if (
          margem > 0 &&
          margem <= 15
        ) {
          oportunidades.push(
            "A margem operacional informada é relativamente baixa; isso reforça a necessidade de comparar Lucro Presumido e Lucro Real."
          );
        }

        if (
          b2b >= 50
        ) {
          riscos.push(
            "A participação relevante de vendas B2B exige avaliar o efeito comercial dos créditos tributários concedidos aos clientes."
          );
        }

        pontos.push(
          "Comparar Simples Nacional, Lucro Presumido e Lucro Real com memória de cálculo."
        );

        pontos.push(
          "Separar receitas por atividade/CNAE e verificar anexos, Fator R e incidências específicas."
        );

        pontos.push(
          "Conferir folha, pró-labore, retenções, compras e despesas dedutíveis."
        );
      } else {
        if (
          b2b >= 50
        ) {
          riscos.push(
            "A empresa possui perfil B2B relevante; a competitividade poderá depender do crédito transferido ao cliente na sistemática IBS/CBS."
          );
        }

        if (
          indiceCompras !== null &&
          indiceCompras < 0.20
        ) {
          riscos.push(
            "O nível de compras informado é baixo em relação ao faturamento, o que pode limitar o volume de créditos no novo modelo."
          );
        }

        if (
          indiceCompras !== null &&
          indiceCompras >= 0.30
        ) {
          oportunidades.push(
            "O volume de compras/insumos sugere potencial relevante de apropriação de créditos, sujeito à validação documental."
          );
        }

        pontos.push(
          "Mapear receitas, compras, serviços tomados e itens potencialmente geradores de créditos."
        );

        pontos.push(
          "Avaliar impacto da transição IBS/CBS sobre preço, margem e contratos."
        );

        pontos.push(
          "Separar operações B2B e B2C para medir efeito comercial e creditício."
        );
      }

      if (
        arquivos.length > 0
      ) {
        oportunidades.push(
          `${arquivos.length} documento(s) já foram selecionados para apoiar a validação da análise.`
        );
      }

      const conclusao =
        dadosFaltantes.length === 0
          ? "A base mínima está preenchida e o projeto pode avançar para os cálculos tributários detalhados."
          : "Foi possível montar um diagnóstico preliminar, mas ainda há dados essenciais que precisam ser confirmados antes da recomendação final.";

      const resultado = {
        criadoEm:
          new Date().toISOString(),
        tipoProjeto,
        conclusao,
        pontos,
        riscos,
        oportunidades,
        dadosFaltantes,
        indicadores: {
          faturamento,
          folha,
          compras,
          despesas,
          b2b,
          margem,
          fatorFolha,
          indiceCompras,
          indiceDespesas,
        },
      };

      setDiagnosticoGerado(
        resultado
      );

      registrarHistorico(
        "DIAGNOSTICO_GERADO",
        "Diagnóstico tributário preliminar gerado.",
        {
          riscos:
            riscos.length,
          oportunidades:
            oportunidades.length,
          dadosFaltantes:
            dadosFaltantes.length,
        }
      );

      setAbaAnalise(
        "diagnostico"
      );
    } finally {
      setGerandoDiagnostico(
        false
      );
    }
  }

  function escolherProjeto(
    tipo
  ) {
    setTipoProjeto(tipo);

    registrarHistorico(
      "PROJETO_CRIADO",
      tipo === "reforma"
        ? "Nova análise de Reforma Tributária iniciada."
        : "Novo Planejamento Tributário iniciado.",
      {
        tipoProjeto: tipo,
      }
    );

    if (tipo === "planejamento") {
      setTela("planejamento-v2");
      return;
    }

    if (tipo === "reforma") {
      setTela("reforma-v2");
      return;
    }

    setTela("configuracao");
  }

  function alterarEmpresa(
    id,
    patch
  ) {
    setEmpresas(
      (atuais) =>
        atuais.map(
          (empresa) =>
            empresa.id === id
              ? {
                  ...empresa,
                  ...patch,
                }
              : empresa
        )
    );
  }

  async function buscarCnpj(
    empresa
  ) {
    const digits =
      somenteDigitos(
        empresa.cnpj
      );

    if (
      digits.length !==
      14
    ) {
      alterarEmpresa(
        empresa.id,
        {
          erro:
            "Informe um CNPJ com 14 dígitos.",
        }
      );
      return;
    }

    alterarEmpresa(
      empresa.id,
      {
        carregando:
          true,
        erro:
          "",
      }
    );

    try {
      const resposta =
        await fetch(
          `/api/cnpj?cnpj=${encodeURIComponent(
            digits
          )}`
        );

      const data =
        await resposta
          .json()
          .catch(
            () => null
          );

      if (
        !resposta.ok ||
        !data?.sucesso
      ) {
        throw new Error(
          data?.error ||
          "Erro ao consultar CNPJ."
        );
      }

      const dados =
        normalizarRespostaCnpj(
          data
        );

      alterarEmpresa(
        empresa.id,
        {
          cnpj:
            formatarCnpj(
              digits
            ),
          dados,
          erro:
            "",
        }
      );

      const lista =
        normalizarListaCnaes({
          dados,
        });

      setAtividadesSelecionadas(
        lista
      );

      const principal =
        lista.find(
          (item) =>
            item.principal ||
            item.tipo ===
              "principal"
        ) ||
        lista[0] ||
        null;

      setAtividadePrincipalSelecionada(
        principal
          ? chaveAtividade(
              principal
            )
          : ""
      );

      registrarHistorico(
        "CNPJ_CONSULTADO",
        `CNPJ ${formatarCnpj(
          digits
        )} consultado com ${
          lista.length
        } CNAE(s).`,
        {
          razaoSocial:
            dados.razaoSocial,
          quantidadeCnaes:
            lista.length,
        }
      );
    } catch (
      error
    ) {
      alterarEmpresa(
        empresa.id,
        {
          erro:
            error?.message ||
            "Erro ao consultar CNPJ.",
        }
      );
    } finally {
      alterarEmpresa(
        empresa.id,
        {
          carregando:
            false,
        }
      );
    }
  }

  function normalizarListaCnaes(
    empresa
  ) {
    const dados =
      empresa?.dados ||
      {};

    const origem =
      Array.isArray(
        dados.todosCnaes
      ) &&
      dados.todosCnaes.length
        ? dados.todosCnaes
        : [
            dados.cnaePrincipal,
            ...(Array.isArray(
              dados.cnaesSecundarios
            )
              ? dados.cnaesSecundarios
              : []),
          ];

    const mapa =
      new Map();

    origem.forEach(
      (item) => {
        if (!item) {
          return;
        }

        const codigo =
          String(
            item.codigo ||
            item.code ||
            item.cnae ||
            ""
          );

        const descricao =
          String(
            item.descricao ||
            item.description ||
            item.nome ||
            ""
          );

        const chave =
          codigo.replace(
            /\D/g,
            ""
          ) ||
          descricao
            .toLowerCase()
            .trim();

        if (!chave) {
          return;
        }

        mapa.set(
          chave,
          {
            ...item,
            codigo,
            descricao,
            tipo:
              item.principal
                ? "principal"
                : "secundaria",
            principal:
              Boolean(
                item.principal
              ),
          }
        );
      }
    );

    return Array.from(
      mapa.values()
    );
  }

  const atividadesDisponiveis =
    empresas
      .flatMap(
        (empresa) =>
          normalizarListaCnaes(
            empresa
          )
      );

  function chaveAtividade(
    item
  ) {
    return `${item.codigo}|${item.descricao}`;
  }

  function alternarAtividade(
    item
  ) {
    const chave =
      chaveAtividade(
        item
      );

    setAtividadesSelecionadas(
      (atuais) => {
        const existe =
          atuais.some(
            (a) =>
              chaveAtividade(a) ===
              chave
          );

        if (existe) {
          return atuais.filter(
            (a) =>
              chaveAtividade(a) !==
              chave
          );
        }

        return [
          ...atuais,
          item,
        ];
      }
    );
  }

  function preencherAtividadesPadrao() {
    if (
      !atividadesDisponiveis.length
    ) {
      return;
    }

    const principais =
      atividadesDisponiveis.filter(
        (item) =>
          item.tipo ===
          "principal"
      );

    if (
      principais.length &&
      !atividadePrincipalSelecionada
    ) {
      setAtividadePrincipalSelecionada(
        chaveAtividade(
          principais[0]
        )
      );
    }

    if (
      !atividadesSelecionadas.length
    ) {
      setAtividadesSelecionadas(
        atividadesDisponiveis
      );
    }
  }

  function continuarParaDados() {
    if (
      !dadosProjeto.responsavelFinder.trim()
    ) {
      setErro(
        "Informe o responsável Finder pelo cliente."
      );
      return;
    }

    if (
      !dadosProjeto.origemCliente
    ) {
      setErro(
        "Informe de onde veio o cliente."
      );
      return;
    }

    if (
      !empresasConsultadas
    ) {
      setErro(
        "Consulte pelo menos um CNPJ antes de continuar."
      );
      return;
    }

    registrarHistorico(
      "IDENTIFICACAO_CONFIRMADA",
      "Responsável, origem e empresas confirmados.",
      {
        responsavelFinder:
          dadosProjeto.responsavelFinder,
        origemCliente:
          dadosProjeto.origemCliente,
        observacaoOrigem:
          dadosProjeto.observacaoOrigem,
        empresas:
          empresasConsultadas,
      }
    );

    setErro("");
    setTela(
      "dados"
    );
  }

  function continuarParaAnalise() {
    const precisaDocumento =
      modalidade === "documentos" ||
      modalidade === "hibrido";

    const precisaManual =
      modalidade === "manual" ||
      modalidade === "hibrido";

    if (
      precisaDocumento &&
      arquivos.length === 0
    ) {
      setErro(
        "Selecione pelo menos um documento para continuar."
      );
      return;
    }

    if (
      precisaManual
    ) {
      const temDadoManual =
        Object.values(
          dadosManuais || {}
        ).some(
          (valor) =>
            String(
              valor ?? ""
            ).trim() !== ""
        );

      if (!temDadoManual) {
        setErro(
          "Preencha pelo menos um dado manual para continuar."
        );
        return;
      }
    }

    registrarHistorico(
      "BASE_REVISADA",
      "Base documental/manual enviada para revisão.",
      {
        modalidade,
        documentos:
          arquivos.length,
        empresas:
          empresasConsultadas,
      }
    );

    setErro("");
    setTela(
      "revisao"
    );
  }

  if (
    tela ===
    "planejamento-v2"
  ) {
    return (
      <PlanejamentoTributario
        token={token}
        onVoltar={() => {
          setTipoProjeto("");
          setTela("inicio");
        }}
      />
    );
  }
  if (
    tela ===
    "reforma-v2"
  ) {
    return (
      <ReformaTributariaV2
        token={token}
        onVoltar={() => setTela("inicio")}
      />
    );
  }


  if (
    tela ===
    "inicio"
  ) {
    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color: NAVY,
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg,#0E1A33,#17233D)",
            color: WHITE,
            borderRadius: 22,
            padding: 24,
            marginBottom: 18,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color:
                "#FFB7A7",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 1.3,
            }}
          >
            FINDER TAX INTELLIGENCE
          </div>

          <h2
            style={{
              margin:
                "7px 0 6px",
              fontFamily:
                DISPLAY_FONT,
              fontSize: 28,
            }}
          >
            Inteligência Tributária
          </h2>

          <p
            style={{
              margin: 0,
              maxWidth: 760,
              color:
                "#D8DEEA",
              fontSize: 11,
              lineHeight: 1.55,
            }}
          >
            Um módulo independente para analisar Reforma Tributária e Planejamento Tributário a partir de documentos, dados manuais ou das duas fontes juntas.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(300px,1fr))",
            gap: 14,
          }}
        >
          <Card
            style={{
              borderTop:
                `4px solid ${CORAL}`,
            }}
          >
            <div
              style={{
                color: CORAL,
                fontSize: 9,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              REFORMA TRIBUTÁRIA
            </div>

            <h3
              style={{
                margin: 0,
                fontFamily:
                  DISPLAY_FONT,
                fontSize: 22,
              }}
            >
              IBS, CBS e transição
            </h3>

            <p
              style={{
                color: MUTED,
                fontSize: 10.5,
                lineHeight: 1.55,
                minHeight: 66,
              }}
            >
              Impactos por empresa ou grupo, créditos, perfil B2B/B2C, precificação, transição e pontos de atenção.
            </p>

            <Botao
              onClick={() =>
                escolherProjeto(
                  "reforma"
                )
              }
            >
              Nova análise de Reforma
            </Botao>
          </Card>

          <Card
            style={{
              borderTop:
                "4px solid #31589C",
            }}
          >
            <div
              style={{
                color:
                  "#31589C",
                fontSize: 9,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              PLANEJAMENTO TRIBUTÁRIO
            </div>

            <h3
              style={{
                margin: 0,
                fontFamily:
                  DISPLAY_FONT,
                fontSize: 22,
              }}
            >
              Regime e eficiência tributária
            </h3>

            <p
              style={{
                color: MUTED,
                fontSize: 10.5,
                lineHeight: 1.55,
                minHeight: 66,
              }}
            >
              Base para comparar Simples Nacional, Lucro Presumido e Lucro Real usando dados reais da operação.
            </p>

            <Botao
              onClick={() =>
                escolherProjeto(
                  "planejamento"
                )
              }
              style={{
                background:
                  "#31589C",
              }}
            >
              Novo planejamento
            </Botao>
          </Card>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 10,
          }}
        >
          {[
            [
              "1",
              "Consultar CNPJ",
              "Empresa única ou várias empresas.",
            ],
            [
              "2",
              "Escolher a fonte",
              "Documentos, manual ou híbrido.",
            ],
            [
              "3",
              "Conferir os dados",
              "IA extrairá e o consultor validará.",
            ],
            [
              "4",
              "Calcular e interpretar",
              "Motor matemático + diagnóstico IA.",
            ],
          ].map(
            ([
              numero,
              titulo,
              texto,
            ]) => (
              <Card
                key={numero}
                style={{
                  padding: 13,
                }}
              >
                <div
                  style={{
                    color: CORAL,
                    fontWeight: 900,
                    fontSize: 18,
                  }}
                >
                  {numero}
                </div>

                <strong
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 11,
                  }}
                >
                  {titulo}
                </strong>

                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    marginTop: 3,
                    lineHeight: 1.45,
                  }}
                >
                  {texto}
                </div>
              </Card>
            )
          )}
        </div>
        <Card
          style={{
            marginTop:
              16,
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              gap:
                12,
              alignItems:
                "flex-start",
              flexWrap:
                "wrap",
              marginBottom:
                12,
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "#31589C",
                  fontSize:
                    9,
                  fontWeight:
                    900,
                }}
              >
                HISTÓRICO DOS DIAGNÓSTICOS
              </div>

              <h3
                style={{
                  margin:
                    "4px 0 3px",
                  fontFamily:
                    DISPLAY_FONT,
                  fontSize:
                    20,
                }}
              >
                Diagnósticos realizados
              </h3>

              <div
                style={{
                  color:
                    MUTED,
                  fontSize:
                    10,
                }}
              >
                Salvos por cliente, responsável, tipo, status e versão.
              </div>
            </div>

            <Botao
              secundario
              onClick={
                carregarProjetosSalvos
              }
              disabled={
                carregandoProjetos
              }
            >
              {carregandoProjetos
                ? "Atualizando..."
                : "Atualizar"}
            </Botao>
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "minmax(220px,1.4fr) repeat(4,minmax(140px,1fr)) auto",
              gap:
                8,
              marginBottom:
                12,
            }}
          >
            <input
              value={
                filtroHistorico.busca
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    busca:
                      e.target.value,
                  })
                )
              }
              placeholder="Buscar cliente ou CNPJ..."
              style={
                inputStyle()
              }
            />

            <select
              value={
                filtroHistorico.tipo
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    tipo:
                      e.target.value,
                  })
                )
              }
              style={
                inputStyle()
              }
            >
              <option value="">
                Todos os tipos
              </option>

              <option value="reforma">
                Reforma Tributária
              </option>

              <option value="planejamento">
                Planejamento Tributário
              </option>
            </select>

            <select
              value={
                filtroHistorico.responsavel
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    responsavel:
                      e.target.value,
                  })
                )
              }
              style={
                inputStyle()
              }
            >
              <option value="">
                Todos os responsáveis
              </option>

              {responsaveisHistorico.map(
                (
                  nome
                ) => (
                  <option
                    key={
                      nome
                    }
                    value={
                      nome
                    }
                  >
                    {nome}
                  </option>
                )
              )}
            </select>

            <select
              value={
                filtroHistorico.status
              }
              onChange={(e) =>
                setFiltroHistorico(
                  (
                    atual
                  ) => ({
                    ...atual,
                    status:
                      e.target.value,
                  })
                )
              }
              style={
                inputStyle()
              }
            >
              <option value="">
                Todos os status
              </option>

              <option value="EM_ANALISE">
                Em análise
              </option>

              <option value="PROCESSANDO_IA">
                Processando IA
              </option>

              <option value="DIAGNOSTICO_GERADO">
                Diagnóstico gerado
              </option>

              <option value="VALIDADO">
                Validado
              </option>
            </select>

            <select
              value={filtroHistorico.arquivamento}
              onChange={(e) =>
                setFiltroHistorico((atual) => ({
                  ...atual,
                  arquivamento: e.target.value,
                }))
              }
              style={inputStyle()}
            >
              <option value="ATIVOS">Ativos</option>
              <option value="ARQUIVADOS">Arquivados</option>
              <option value="TODOS">Ativos + arquivados</option>
            </select>

            <Botao
              onClick={
                carregarProjetosSalvos
              }
            >
              Filtrar
            </Botao>
          </div>

          {!projetosSalvos.length ? (
            <div
              style={{
                border:
                  "1px dashed #C9D1DF",
                borderRadius:
                  12,
                padding:
                  20,
                color:
                  MUTED,
                fontSize:
                  10,
                textAlign:
                  "center",
              }}
            >
              Nenhum diagnóstico salvo com os filtros atuais.
            </div>
          ) : (
            <div
              style={{
                display:
                  "grid",
                gap:
                  8,
              }}
            >
              {projetosSalvos.map(
                (
                  projeto
                ) => (
                  <div
                    key={projeto.id}
                    style={{
                      width:"100%",
                      border:"1px solid #E3E7EF",
                      borderRadius:12,
                      background:projeto.arquivado ? "#F7F8FA" : WHITE,
                      padding:12,
                      display:"grid",
                      gridTemplateColumns:"minmax(220px,2fr) minmax(150px,1fr) minmax(130px,1fr) 60px 105px 245px",
                      gap:10,
                      alignItems:"center",
                      color:NAVY,
                      opacity:projeto.arquivado ? .72 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => abrirProjetoSalvo(projeto.id)}
                      style={{
                        border:0,background:"transparent",padding:0,cursor:"pointer",
                        textAlign:"left",color:NAVY
                      }}
                    >
                      <strong style={{display:"block",fontSize:11.5}}>
                        {projeto.clienteNome || "Cliente"}
                      </strong>
                      <div style={{color:MUTED,fontSize:9,marginTop:3}}>
                        {projeto.cnpj || "CNPJ não informado"}
                        {projeto.arquivado ? " · ARQUIVADO" : ""}
                      </div>
                    </button>

                    <strong style={{fontSize:9.5}}>
                      {projeto.tipoProjeto === "reforma" ? "Reforma Tributária" : "Planejamento Tributário"}
                    </strong>

                    <strong style={{fontSize:9.5}}>
                      {projeto.responsavelFinder || "-"}
                    </strong>

                    <strong>V{projeto.versaoAtual || 0}</strong>

                    <span style={{
                      borderRadius:999,padding:"5px 7px",
                      background:projeto.status==="VALIDADO"?"#E9F7EF":"#EEF3FF",
                      color:projeto.status==="VALIDADO"?"#176B47":"#31589C",
                      fontSize:8,fontWeight:900,textAlign:"center"
                    }}>
                      {projeto.status || "EM_ANALISE"}
                    </span>

                    <div style={{display:"flex",gap:5,justifyContent:"flex-end",flexWrap:"wrap"}}>
                      <button type="button" onClick={()=>editarProjetoSalvo(projeto.id)}
                        style={{border:"1px solid #CAD3E2",background:WHITE,borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:8.5,fontWeight:800}}>
                        Editar
                      </button>
                      <button type="button" onClick={()=>arquivarProjetoSalvo(projeto.id,!projeto.arquivado)}
                        style={{border:"1px solid #CAD3E2",background:WHITE,borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:8.5,fontWeight:800}}>
                        {projeto.arquivado ? "Reativar" : "Arquivar"}
                      </button>
                      <button type="button" onClick={()=>excluirProjetoSalvo(projeto.id,projeto.clienteNome||"esta inteligência tributária")}
                        style={{border:"1px solid #E7B9B9",background:"#FFF7F7",color:"#A22",borderRadius:7,padding:"6px 8px",cursor:"pointer",fontSize:8.5,fontWeight:800}}>
                        Excluir
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>

      </div>
    );
  }

  if (
    tela ===
    "projeto-salvo" &&
    projetoAberto
  ) {
    const ultimo =
      projetoAberto
        .diagnosticos?.[0] ||
      null;

    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color:
            NAVY,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setProjetoAberto(
              null
            );
            setTela(
              "inicio"
            );
          }}
          style={{
            border:
              0,
            background:
              "transparent",
            color:
              MUTED,
            cursor:
              "pointer",
            fontWeight:
              800,
            marginBottom:
              12,
          }}
        >
          ← Voltar aos diagnósticos
        </button>

        <div
          style={{
            background:
              "linear-gradient(135deg,#0E1A33,#17233D)",
            color:
              WHITE,
            borderRadius:
              18,
            padding:
              20,
            marginBottom:
              14,
          }}
        >
          <div
            style={{
              color:
                "#FFB7A7",
              fontSize:
                9,
              fontWeight:
                900,
            }}
          >
            {projetoAberto.tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "5px 0 4px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            {projetoAberto.clienteNome ||
              "Cliente"}
          </h2>

          <div
            style={{
              color:
                "#D8DEEA",
              fontSize:
                10,
            }}
          >
            {projetoAberto.cnpj ||
              "Sem CNPJ"}{" "}
            · Responsável:{" "}
            <strong>
              {projetoAberto.responsavelFinder ||
                "-"}
            </strong>{" "}
            · Origem:{" "}
            <strong>
              {projetoAberto.origemCliente ||
                "-"}
            </strong>
          </div>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap:
              10,
            marginBottom:
              14,
          }}
        >
          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              STATUS
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
              }}
            >
              {projetoAberto.status}
            </strong>
          </Card>

          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              VERSÕES
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
                fontSize:
                  24,
              }}
            >
              {projetoAberto
                .diagnosticos
                ?.length ||
                0}
            </strong>
          </Card>

          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              CRIADO POR
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
              }}
            >
              {projetoAberto.criadoPorNome ||
                "-"}
            </strong>
          </Card>

          <Card>
            <div
              style={{
                color:
                  MUTED,
                fontSize:
                  9,
                fontWeight:
                  900,
              }}
            >
              VALIDADO POR
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  7,
              }}
            >
              {projetoAberto.validadoPorNome ||
                "Pendente"}
            </strong>
          </Card>
        </div>

        {ultimo ? (
          <div
            style={{
              display:
                "grid",
              gap:
                12,
            }}
          >
            <Card
              style={{
                borderLeft:
                  "4px solid #31589C",
              }}
            >
              <div
                style={{
                  color:
                    "#31589C",
                  fontSize:
                    9,
                  fontWeight:
                    900,
                }}
              >
                ÚLTIMA VERSÃO · V{ultimo.versao}
              </div>

              <h3
                style={{
                  margin:
                    "6px 0 6px",
                  fontFamily:
                    DISPLAY_FONT,
                }}
              >
                Resumo executivo
              </h3>

              <div
                style={{
                  color:
                    MUTED,
                  fontSize:
                    10.5,
                  lineHeight:
                    1.65,
                }}
              >
                {ultimo.diagnostico?.resumoExecutivo ||
                  ultimo.diagnostico?.conclusao ||
                  "Sem resumo disponível."}
              </div>
            </Card>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(250px,1fr))",
                gap:
                  12,
              }}
            >
              <Card>
                <strong>
                  Riscos
                </strong>

                <div
                  style={{
                    display:
                      "grid",
                    gap:
                      6,
                    marginTop:
                      9,
                  }}
                >
                  {(ultimo.diagnostico?.riscos ||
                    []).map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        style={{
                          background:
                            "#FFF4F0",
                          borderRadius:
                            8,
                          padding:
                            9,
                          fontSize:
                            9.5,
                        }}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </Card>

              <Card>
                <strong>
                  Oportunidades
                </strong>

                <div
                  style={{
                    display:
                      "grid",
                    gap:
                      6,
                    marginTop:
                      9,
                  }}
                >
                  {(ultimo.diagnostico?.oportunidades ||
                    []).map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        style={{
                          background:
                            "#EEF9F3",
                          borderRadius:
                            8,
                          padding:
                            9,
                          fontSize:
                            9.5,
                        }}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div>
                  <strong>Gerenciar inteligência tributária</strong>
                  <div style={{color:MUTED,fontSize:9.5,marginTop:3}}>
                    Edite mantendo o mesmo projeto e histórico, arquive sem apagar ou exclua definitivamente.
                  </div>
                </div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  <Botao secundario onClick={()=>editarProjetoSalvo(projetoAberto.id)}>Editar</Botao>
                  <Botao secundario onClick={()=>arquivarProjetoSalvo(projetoAberto.id,!projetoAberto.arquivado)}>
                    {projetoAberto.arquivado ? "Reativar" : "Arquivar"}
                  </Botao>
                  <button type="button"
                    onClick={()=>excluirProjetoSalvo(projetoAberto.id,projetoAberto.clienteNome||"esta inteligência tributária")}
                    style={{border:"1px solid #E7B9B9",background:"#FFF7F7",color:"#A22",borderRadius:8,padding:"8px 11px",cursor:"pointer",fontWeight:900,fontSize:9}}>
                    Excluir definitivamente
                  </button>
                </div>
              </div>
            </Card>

            <Card>
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap:
                    10,
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <strong>
                    Validação
                  </strong>

                  <div
                    style={{
                      color:
                        MUTED,
                      fontSize:
                        9.5,
                      marginTop:
                        3,
                    }}
                  >
                    Mantém todas as versões e registra quem validou.
                  </div>
                </div>

                {projetoAberto.status !==
                  "VALIDADO" && (
                  <Botao
                    onClick={() =>
                      validarProjetoSalvo(
                        projetoAberto.id
                      )
                    }
                  >
                    Validar diagnóstico
                  </Botao>
                )}
              </div>
            </Card>

            <Card>
              <strong>
                Histórico de versões
              </strong>

              <div
                style={{
                  display:
                    "grid",
                  gap:
                    7,
                  marginTop:
                    10,
                }}
              >
                {projetoAberto.diagnosticos.map(
                  (
                    diag
                  ) => (
                    <div
                      key={
                        diag.id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "70px minmax(0,1fr) 170px",
                        gap:
                          10,
                        border:
                          "1px solid #E3E7EF",
                        borderRadius:
                          9,
                        padding:
                          9,
                      }}
                    >
                      <strong>
                        V{diag.versao}
                      </strong>

                      <div>
                        {diag.modelo ||
                          "IA"}
                      </div>

                      <div
                        style={{
                          color:
                            MUTED,
                          fontSize:
                            9,
                        }}
                      >
                        {diag.criadoEm
                          ? new Date(
                              diag.criadoEm
                            ).toLocaleString(
                              "pt-BR"
                            )
                          : "-"}
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>

            <Card>
              <strong>
                Linha do tempo
              </strong>

              <div
                style={{
                  display:
                    "grid",
                  gap:
                    6,
                  marginTop:
                    10,
                }}
              >
                {(projetoAberto.historico ||
                  []).map(
                  (
                    evento
                  ) => (
                    <div
                      key={
                        evento.id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "150px minmax(0,1fr)",
                        gap:
                          10,
                        padding:
                          9,
                        borderBottom:
                          "1px solid #EEF0F4",
                      }}
                    >
                      <div
                        style={{
                          color:
                            MUTED,
                          fontSize:
                            9,
                        }}
                      >
                        {evento.criadoEm
                          ? new Date(
                              evento.criadoEm
                            ).toLocaleString(
                              "pt-BR"
                            )
                          : "-"}
                      </div>

                      <div>
                        <strong
                          style={{
                            fontSize:
                              9.5,
                          }}
                        >
                          {evento.descricao}
                        </strong>

                        <div
                          style={{
                            color:
                              MUTED,
                            fontSize:
                              8.5,
                            marginTop:
                              2,
                          }}
                        >
                          {evento.usuarioNome ||
                            "-"}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            Ainda não existe diagnóstico salvo neste projeto.
          </Card>
        )}
      </div>
    );
  }

  if (
    tela ===
    "configuracao"
  ) {
    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color: NAVY,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTela(
              "inicio"
            )
          }
          style={{
            border: 0,
            background:
              "transparent",
            color: MUTED,
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          ← Voltar
        </button>

        <div
          style={{
            marginBottom: 18,
          }}
        >
          <div
            style={{
              color:
                tipoProjeto ===
                "reforma"
                  ? CORAL
                  : "#31589C",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "4px 0 4px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Novo projeto tributário
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            Primeiro identifique a empresa ou o grupo que será analisado.
          </div>
        </div>

        <Card
          style={{
            marginBottom: 14,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 10,
            }}
          >
            Estrutura da análise
          </strong>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 10,
            }}
          >
            <ModalidadeCard
              ativa={
                estrutura ===
                "empresa"
              }
              titulo="Empresa única"
              descricao="Planejamento ou Reforma para um único CNPJ."
              onClick={() => {
                setEstrutura(
                  "empresa"
                );

                setEmpresas(
                  (atuais) => [
                    atuais[0] ||
                    novaEmpresa(),
                  ]
                );
              }}
            />

            <ModalidadeCard
              ativa={
                estrutura ===
                "grupo"
              }
              titulo="Grupo de empresas"
              descricao="Analise vários CNPJs individualmente e prepare visão consolidada."
              onClick={() =>
                setEstrutura(
                  "grupo"
                )
              }
            />
          </div>
        </Card>

        <Card
          style={{
            marginBottom: 14,
            borderTop:
              "4px solid #31589C",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 4,
            }}
          >
            Identificação do cliente
          </strong>

          <div
            style={{
              color: MUTED,
              fontSize: 10,
              marginBottom: 12,
            }}
          >
            Registre quem é o responsável pelo relacionamento e de onde este cliente veio.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 10,
            }}
          >
            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                RESPONSÁVEL FINDER
              </span>

              <input
                value={
                  dadosProjeto.responsavelFinder
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "responsavelFinder",
                    e.target.value
                  )
                }
                placeholder="Ex.: Diones"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                ORIGEM DO CLIENTE
              </span>

              <select
                value={
                  dadosProjeto.origemCliente
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "origemCliente",
                    e.target.value
                  )
                }
                style={inputStyle()}
              >
                <option value="">
                  Selecione
                </option>
                <option value="INDICACAO">
                  Indicação
                </option>
                <option value="EVENTO">
                  Evento
                </option>
                <option value="INSTAGRAM">
                  Instagram
                </option>
                <option value="SITE">
                  Site
                </option>
                <option value="WHATSAPP">
                  WhatsApp
                </option>
                <option value="CLIENTE_BASE">
                  Cliente da base
                </option>
                <option value="PARCEIRO">
                  Parceiro
                </option>
                <option value="PROSPECCAO_ATIVA">
                  Prospecção ativa
                </option>
                <option value="OUTRO">
                  Outro
                </option>
              </select>
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                CONTATO DO CLIENTE
              </span>

              <input
                value={
                  dadosProjeto.contatoNome
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "contatoNome",
                    e.target.value
                  )
                }
                placeholder="Nome do contato"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                E-MAIL
              </span>

              <input
                type="email"
                value={
                  dadosProjeto.contatoEmail
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "contatoEmail",
                    e.target.value
                  )
                }
                placeholder="cliente@empresa.com"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                TELEFONE
              </span>

              <input
                value={
                  dadosProjeto.contatoTelefone
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "contatoTelefone",
                    e.target.value
                  )
                }
                placeholder="(41) 99999-9999"
                style={inputStyle()}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  fontSize: 9.5,
                  fontWeight: 900,
                  marginBottom: 5,
                }}
              >
                DETALHE DA ORIGEM
              </span>

              <input
                value={
                  dadosProjeto.observacaoOrigem
                }
                onChange={(e) =>
                  alterarDadosProjeto(
                    "observacaoOrigem",
                    e.target.value
                  )
                }
                placeholder="Ex.: Feira do Empreendedor 2026"
                style={inputStyle()}
              />
            </label>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {empresas.map(
            (empresa, index) => (
              <EmpresaCard
                key={empresa.id}
                empresa={empresa}
                index={index}
                onChangeCnpj={(valor) =>
                  alterarEmpresa(
                    empresa.id,
                    {
                      cnpj: valor,
                      dados: null,
                      erro: "",
                    }
                  )
                }
                onBuscar={() =>
                  buscarCnpj(
                    empresa
                  )
                }
                podeRemover={
                  estrutura ===
                    "grupo" &&
                  empresas.length >
                    1
                }
                onRemover={() =>
                  setEmpresas(
                    (atuais) =>
                      atuais.filter(
                        (item) =>
                          item.id !==
                          empresa.id
                      )
                  )
                }
              />
            )
          )}
        </div>

        {estrutura ===
          "grupo" && (
          <Botao
            secundario
            onClick={() =>
              setEmpresas(
                (atuais) => [
                  ...atuais,
                  novaEmpresa(),
                ]
              )
            }
            style={{
              marginTop: 10,
            }}
          >
            + Adicionar empresa
          </Botao>
        )}

        {erro && (
          <div
            style={{
              marginTop: 12,
              background:
                "#FAECE7",
              color: "#993C1D",
              borderRadius: 10,
              padding: 10,
              fontSize: 10.5,
            }}
          >
            {erro}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            marginTop: 16,
          }}
        >
          <Botao
            onClick={
              continuarParaDados
            }
          >
            Continuar →
          </Botao>
        </div>
      </div>
    );
  }

  if (
    tela ===
    "revisao"
  ) {
    return (
      <div
        style={{
          fontFamily:
            BODY_FONT,
          color: NAVY,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTela(
              "dados"
            )
          }
          style={{
            border: 0,
            background:
              "transparent",
            color: MUTED,
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          ← Voltar aos dados
        </button>

        <div
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color:
                tipoProjeto ===
                "reforma"
                  ? CORAL
                  : "#31589C",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "4px 0 5px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Revisão da base
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            Confira o que foi selecionado antes de iniciar a análise tributária.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              EMPRESAS
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              {empresasConsultadas}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              DOCUMENTOS
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              {arquivos.length}
            </div>
          </Card>

          <Card>
            <div
              style={{
                color: MUTED,
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              MODALIDADE
            </div>

            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {modalidade === "hibrido"
                ? "Híbrido"
                : modalidade === "manual"
                ? "Manual"
                : "Documentos"}
            </div>
          </Card>
        </div>

        <Card
          style={{
            marginBottom: 14,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 10,
            }}
          >
            Empresas da análise
          </strong>

          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {empresas
              .filter(
                (empresa) =>
                  empresa.dados
              )
              .map(
                (
                  empresa,
                  index
                ) => (
                  <div
                    key={
                      empresa.id
                    }
                    style={{
                      border:
                        "1px solid #E3E7EF",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 11,
                      }}
                    >
                      {index + 1}.{" "}
                      {empresa.dados.razaoSocial ||
                        empresa.dados.razao_social ||
                        empresa.dados.nome ||
                        "Empresa"}
                    </strong>

                    <div
                      style={{
                        color: MUTED,
                        fontSize: 9.5,
                        marginTop: 4,
                      }}
                    >
                      {formatarCnpj(
                        empresa.dados.cnpj ||
                        empresa.cnpj
                      )}
                    </div>
                  </div>
                )
              )}
          </div>
        </Card>

        <Card
          style={{
            marginBottom: 14,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 10,
            }}
          >
            Atividades consideradas
          </strong>

          <div
            style={{
              display: "grid",
              gap: 7,
            }}
          >
            {atividadesSelecionadas.length ? (
              atividadesSelecionadas.map(
                (
                  item,
                  index
                ) => {
                  const principal =
                    chaveAtividade(
                      item
                    ) ===
                    atividadePrincipalSelecionada;

                  return (
                    <div
                      key={index}
                      style={{
                        border:
                          principal
                            ? "1px solid #31589C"
                            : "1px solid #E3E7EF",
                        background:
                          principal
                            ? "#F8FAFF"
                            : WHITE,
                        borderRadius: 9,
                        padding: 9,
                        fontSize: 10,
                      }}
                    >
                      <strong>
                        {item.codigo ||
                          "CNAE"}{" "}
                        ·{" "}
                        {item.descricao ||
                          "Atividade"}
                      </strong>

                      {principal && (
                        <span
                          style={{
                            marginLeft: 7,
                            color: "#31589C",
                            fontSize: 8,
                            fontWeight: 900,
                          }}
                        >
                          PRINCIPAL REAL
                        </span>
                      )}
                    </div>
                  );
                }
              )
            ) : (
              <div
                style={{
                  color: MUTED,
                  fontSize: 10,
                }}
              >
                Nenhuma atividade selecionada.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              color: MUTED,
              fontSize: 9.5,
              lineHeight: 1.5,
            }}
          >
            <strong>
              Operação descrita:
            </strong>{" "}
            {descricaoAtividadeCliente ||
              "-"}
          </div>
        </Card>

        {!!arquivos.length && (
          <Card
            style={{
              marginBottom: 14,
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 10,
              }}
            >
              Documentos selecionados
            </strong>

            <div
              style={{
                display: "grid",
                gap: 6,
              }}
            >
              {arquivos.map(
                (
                  arquivo,
                  index
                ) => (
                  <div
                    key={`${arquivo.name}-${index}`}
                    style={{
                      background:
                        "#F7F8FB",
                      borderRadius: 8,
                      padding: 9,
                      fontSize: 10,
                    }}
                  >
                    {arquivo.name}
                  </div>
                )
              )}
            </div>
          </Card>
        )}

        <Card
          style={{
            border:
              "1px solid #F2C5B8",
            background:
              "#FFF9F7",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: CORAL,
              fontWeight: 900,
            }}
          >
            BASE PRONTA
          </div>

          <h3
            style={{
              margin:
                "6px 0 5px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Próximo passo: análise por IA
          </h3>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
              lineHeight: 1.55,
            }}
          >
            A seleção agora pode avançar normalmente. Na próxima versão, este botão enviará os documentos ao banco próprio do módulo e iniciará a extração e conferência pela IA.
          </div>

          <Botao
            onClick={() => {
              registrarHistorico(
                "ANALISE_INICIADA",
                "Projeto encaminhado para a etapa de análise tributária.",
                {
                  tipoProjeto,
                  modalidade,
                  documentos:
                    arquivos.length,
                }
              );

              setTela(
                "analise"
              );
            }}
            style={{
              marginTop: 12,
            }}
          >
            Iniciar análise tributária →
          </Botao>
        </Card>
      </div>
    );
  }

  if (
    tela ===
    "analise"
  ) {
    const empresaPrincipal =
      empresas.find(
        (empresa) =>
          empresa.dados
      );

    const nomeEmpresa =
      empresaPrincipal?.dados?.razaoSocial ||
      empresaPrincipal?.dados?.razao_social ||
      empresaPrincipal?.dados?.nome ||
      "Cliente";

    return (
      <div
        style={{
          fontFamily: BODY_FONT,
          color: NAVY,
        }}
      >
        <button
          type="button"
          onClick={() =>
            setTela(
              "revisao"
            )
          }
          style={{
            border: 0,
            background: "transparent",
            color: MUTED,
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          ← Voltar à revisão
        </button>

        <div
          style={{
            background:
              "linear-gradient(135deg,#0E1A33,#17233D)",
            color: WHITE,
            borderRadius: 18,
            padding: 20,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: "#FFB7A7",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto === "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin: "5px 0 4px",
              fontFamily: DISPLAY_FONT,
            }}
          >
            {nomeEmpresa}
          </h2>

          <div
            style={{
              color: "#D8DEEA",
              fontSize: 10.5,
            }}
          >
            Responsável Finder:{" "}
            <strong>
              {dadosProjeto.responsavelFinder ||
                "-"}
            </strong>
            {" · "}
            Origem:{" "}
            <strong>
              {dadosProjeto.origemCliente ||
                "-"}
            </strong>
            {dadosProjeto.observacaoOrigem
              ? ` · ${dadosProjeto.observacaoOrigem}`
              : ""}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {[
            ["resumo", "Visão geral"],
            ["cliente", "Cliente / Origem"],
            [
              "diagnostico",
              diagnosticoGerado
                ? "Diagnóstico"
                : "Montar diagnóstico",
            ],
            [
              "historico",
              `Histórico (${historicoProjeto.length})`,
            ],
          ].map(
            ([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setAbaAnalise(
                    id
                  )
                }
                style={{
                  border:
                    abaAnalise === id
                      ? `1px solid ${CORAL}`
                      : "1px solid #D8DEEA",
                  background:
                    abaAnalise === id
                      ? "#FFF3EF"
                      : WHITE,
                  color:
                    abaAnalise === id
                      ? "#993C1D"
                      : NAVY,
                  borderRadius: 999,
                  padding: "8px 11px",
                  cursor: "pointer",
                  fontSize: 9.5,
                  fontWeight: 900,
                }}
              >
                {label}
              </button>
            )
          )}
        </div>

        {(gerandoDiagnostico ||
          diagnosticoOrigem ===
            "IA_REAL" ||
          progressoIa.etapa ===
            "ERRO") && (
          <Card
            style={{
              marginBottom:
                14,
              background:
                diagnosticoOrigem ===
                "IA_REAL"
                  ? "#EEF9F3"
                  : progressoIa.etapa ===
                    "ERRO"
                  ? "#FFF4F0"
                  : "#F8FAFF",
              border:
                diagnosticoOrigem ===
                "IA_REAL"
                  ? "1px solid #BFE5D1"
                  : progressoIa.etapa ===
                    "ERRO"
                  ? "1px solid #F0C6B9"
                  : "1px solid #C9D5F5",
            }}
          >
            <div
              style={{
                fontSize:
                  9,
                fontWeight:
                  900,
                color:
                  diagnosticoOrigem ===
                  "IA_REAL"
                    ? "#176B47"
                    : progressoIa.etapa ===
                      "ERRO"
                    ? "#993C1D"
                    : "#31589C",
              }}
            >
              {diagnosticoOrigem ===
              "IA_REAL"
                ? `✓ DIAGNÓSTICO SALVO · V${versaoDiagnostico || "-"}`
                : progressoIa.etapa ===
                  "ERRO"
                ? "ERRO NA ANÁLISE"
                : "FINDER TAX AI · PROCESSANDO"}
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  5,
                fontSize:
                  11.5,
              }}
            >
              {diagnosticoOrigem ===
              "IA_REAL"
                ? `${arquivosProcessadosIa.length} documento(s) analisado(s). O diagnóstico está disponível no histórico por responsável.`
                : progressoIa.mensagem ||
                  "Preparando análise..."}
            </strong>
          </Card>
        )}

        {abaAnalise ===
          "resumo" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  EMPRESAS
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    marginTop: 4,
                  }}
                >
                  {empresasConsultadas}
                </div>
              </Card>

              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  DOCUMENTOS
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    marginTop: 4,
                  }}
                >
                  {arquivos.length}
                </div>
              </Card>

              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  RESPONSÁVEL
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {dadosProjeto.responsavelFinder ||
                    "-"}
                </div>
              </Card>

              <Card>
                <div
                  style={{
                    color: MUTED,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  ORIGEM
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {dadosProjeto.origemCliente ||
                    "-"}
                </div>
              </Card>
            </div>

            <Card
              style={{
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  color: MUTED,
                  fontSize: 9,
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                ATIVIDADE CONSIDERADA PELA ANÁLISE
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                }}
              >
                {atividadesSelecionadas.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={index}
                      style={{
                        fontSize: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>
                        {item.codigo ||
                          "CNAE"}{" "}
                        ·{" "}
                        {item.descricao ||
                          "Atividade"}
                      </strong>
                      {chaveAtividade(
                        item
                      ) ===
                      atividadePrincipalSelecionada && (
                        <span
                          style={{
                            color: "#31589C",
                            fontSize: 8,
                            fontWeight: 900,
                            marginLeft: 6,
                          }}
                        >
                          PRINCIPAL
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>

              <div
                style={{
                  color: MUTED,
                  fontSize: 9.5,
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                {descricaoAtividadeCliente ||
                  "-"}
              </div>
            </Card>

            <Card
              style={{
                marginBottom: 14,
                borderLeft:
                  "4px solid #31589C",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#31589C",
                  fontWeight: 900,
                }}
              >
                BASE PRONTA
              </div>

              <h3
                style={{
                  margin: "6px 0 6px",
                  fontFamily: DISPLAY_FONT,
                }}
              >
                Projeto pronto para processamento
              </h3>

              <div
                style={{
                  color: MUTED,
                  fontSize: 10.5,
                  lineHeight: 1.55,
                }}
              >
                A empresa, os documentos, o responsável e a origem do cliente já ficam identificados nesta etapa.
              </div>
            </Card>

            <Card
              style={{
                background: "#FFF9F7",
                border:
                  "1px solid #F2C5B8",
              }}
            >
              <div
                style={{
                  color: CORAL,
                  fontSize: 9,
                  fontWeight: 900,
                }}
              >
                DIAGNÓSTICO TRIBUTÁRIO
              </div>

              <h3
                style={{
                  margin: "6px 0 6px",
                  fontFamily: DISPLAY_FONT,
                }}
              >
                Montar diagnóstico preliminar
              </h3>

              <div
                style={{
                  color: MUTED,
                  fontSize: 10.5,
                  lineHeight: 1.55,
                }}
              >
                Use os dados já informados para montar agora um diagnóstico preliminar com pontos de atenção, oportunidades, dados faltantes e próximos passos.
              </div>

              <Botao
                onClick={
                  gerarDiagnosticoIaReal
                }
                disabled={
                  gerandoDiagnostico
                }
                style={{
                  marginTop: 12,
                }}
              >
                {gerandoDiagnostico
                  ? "Analisando com IA..."
                  : "Analisar com IA →"}
              </Botao>
            </Card>
          </>
        )}

        {abaAnalise ===
          "cliente" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(280px,1fr))",
              gap: 12,
            }}
          >
            <Card>
              <strong
                style={{
                  display: "block",
                  marginBottom: 10,
                }}
              >
                Responsabilidade interna
              </strong>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  fontSize: 10.5,
                }}
              >
                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Responsável Finder
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.responsavelFinder ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Origem
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.origemCliente ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Detalhe da origem
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.observacaoOrigem ||
                      "-"}
                  </strong>
                </div>
              </div>
            </Card>

            <Card>
              <strong
                style={{
                  display: "block",
                  marginBottom: 10,
                }}
              >
                Contato do cliente
              </strong>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  fontSize: 10.5,
                }}
              >
                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Nome
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.contatoNome ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    E-mail
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.contatoEmail ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      color: MUTED,
                    }}
                  >
                    Telefone
                  </span>
                  <br />
                  <strong>
                    {dadosProjeto.contatoTelefone ||
                      "-"}
                  </strong>
                </div>
              </div>
            </Card>
          </div>
        )}

        {abaAnalise ===
          "diagnostico" && (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {!diagnosticoGerado ? (
              <Card
                style={{
                  background:
                    "#FFF9F7",
                  border:
                    "1px solid #F2C5B8",
                }}
              >
                <div
                  style={{
                    color: CORAL,
                    fontSize: 9,
                    fontWeight: 900,
                  }}
                >
                  DIAGNÓSTICO TRIBUTÁRIO
                </div>

                <h3
                  style={{
                    margin:
                      "6px 0 6px",
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                >
                  Gerar diagnóstico preliminar
                </h3>

                <div
                  style={{
                    color: MUTED,
                    fontSize: 10.5,
                    lineHeight: 1.55,
                  }}
                >
                  O sistema utilizará os dados informados e a estrutura do projeto para produzir uma primeira leitura consultiva.
                </div>

                <Botao
                  onClick={
                    gerarDiagnosticoIaReal
                  }
                  disabled={
                    gerandoDiagnostico
                  }
                  style={{
                    marginTop: 12,
                  }}
                >
                  {gerandoDiagnostico
                    ? "Analisando com IA..."
                    : "Analisar documentos e gerar diagnóstico"}
                </Botao>
              </Card>
            ) : (
              <>
                <Card
                  style={{
                    borderLeft:
                      "4px solid #31589C",
                  }}
                >
                  <div
                    style={{
                      color: "#31589C",
                      fontSize: 9,
                      fontWeight: 900,
                    }}
                  >
                    RESUMO EXECUTIVO
                  </div>

                  <h3
                    style={{
                      margin:
                        "6px 0 6px",
                      fontFamily:
                        DISPLAY_FONT,
                    }}
                  >
                    Diagnóstico preliminar
                  </h3>

                  <div
                    style={{
                      color: MUTED,
                      fontSize: 10.5,
                      lineHeight: 1.6,
                    }}
                  >
                    {diagnosticoGerado.conclusao}
                  </div>
                </Card>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(260px,1fr))",
                    gap: 12,
                  }}
                >
                  <Card>
                    <strong>
                      Pontos de análise
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.pontos || diagnosticoGerado.pontosAnalise || []).map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={index}
                            style={{
                              background:
                                "#F7F8FB",
                              borderRadius: 8,
                              padding: 9,
                              fontSize: 10,
                              lineHeight: 1.5,
                            }}
                          >
                            {item}
                          </div>
                        )
                      )}
                    </div>
                  </Card>

                  <Card>
                    <strong>
                      Riscos / atenção
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.riscos || []).length ? (
                        (diagnosticoGerado.riscos || []).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={index}
                              style={{
                                background:
                                  "#FFF4F0",
                                color:
                                  "#8E321C",
                                borderRadius: 8,
                                padding: 9,
                                fontSize: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {item}
                            </div>
                          )
                        )
                      ) : (
                        <div
                          style={{
                            color: MUTED,
                            fontSize: 10,
                          }}
                        >
                          Nenhum alerta relevante identificado com os dados atuais.
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <strong>
                      Oportunidades
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.oportunidades || []).length ? (
                        (diagnosticoGerado.oportunidades || []).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={index}
                              style={{
                                background:
                                  "#EEF9F3",
                                color:
                                  "#176B47",
                                borderRadius: 8,
                                padding: 9,
                                fontSize: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {item}
                            </div>
                          )
                        )
                      ) : (
                        <div
                          style={{
                            color: MUTED,
                            fontSize: 10,
                          }}
                        >
                          Ainda não há dados suficientes para apontar oportunidades.
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <strong>
                      Dados faltantes
                    </strong>

                    <div
                      style={{
                        display: "grid",
                        gap: 7,
                        marginTop: 10,
                      }}
                    >
                      {(diagnosticoGerado.dadosFaltantes || []).length ? (
                        (diagnosticoGerado.dadosFaltantes || []).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={index}
                              style={{
                                background:
                                  "#FFF8E8",
                                color:
                                  "#855A09",
                                borderRadius: 8,
                                padding: 9,
                                fontSize: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {item}
                            </div>
                          )
                        )
                      ) : (
                        <div
                          style={{
                            color:
                              "#176B47",
                            background:
                              "#EEF9F3",
                            borderRadius: 8,
                            padding: 9,
                            fontSize: 10,
                          }}
                        >
                          Base mínima preenchida.
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <Card>
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      alignItems:
                        "center",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        Atualizar diagnóstico
                      </strong>

                      <div
                        style={{
                          color: MUTED,
                          fontSize: 9.5,
                          marginTop: 3,
                        }}
                      >
                        Se você alterar dados ou documentos, gere novamente para atualizar a leitura.
                      </div>
                    </div>

                    <Botao
                      secundario
                      onClick={
                        gerarDiagnosticoIaReal
                      }
                    >
                      Gerar novamente
                    </Botao>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {abaAnalise ===
          "historico" && (
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 10,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: 14,
                  }}
                >
                  Histórico do projeto
                </strong>

                <div
                  style={{
                    color: MUTED,
                    fontSize: 9.5,
                    marginTop: 3,
                  }}
                >
                  Linha do tempo das principais ações realizadas neste planejamento.
                </div>
              </div>

              <span
                style={{
                  background:
                    "#EEF3FF",
                  color: "#31589C",
                  borderRadius: 999,
                  padding: "5px 8px",
                  fontSize: 9,
                  fontWeight: 900,
                }}
              >
                {historicoProjeto.length} evento(s)
              </span>
            </div>

            {!historicoProjeto.length ? (
              <div
                style={{
                  color: MUTED,
                  fontSize: 10,
                }}
              >
                Nenhum evento registrado ainda.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                }}
              >
                {historicoProjeto.map(
                  (evento) => (
                    <div
                      key={
                        evento.id
                      }
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "135px minmax(0,1fr)",
                        gap: 10,
                        border:
                          "1px solid #E3E7EF",
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          color: MUTED,
                          fontSize: 9,
                        }}
                      >
                        {formatarDataHora(
                          evento.criadoEm
                        )}
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            fontSize: 10.5,
                          }}
                        >
                          {evento.descricao}
                        </strong>

                        <div
                          style={{
                            color: "#31589C",
                            fontSize: 8.5,
                            fontWeight: 900,
                            marginTop: 3,
                          }}
                        >
                          {evento.tipo}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily:
          BODY_FONT,
        color: NAVY,
      }}
    >
      <button
        type="button"
        onClick={() =>
          setTela(
            "configuracao"
          )
        }
        style={{
          border: 0,
          background:
            "transparent",
          color: MUTED,
          cursor: "pointer",
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        ← Voltar às empresas
      </button>

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color:
                tipoProjeto ===
                "reforma"
                  ? CORAL
                  : "#31589C",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {tipoProjeto ===
            "reforma"
              ? "REFORMA TRIBUTÁRIA"
              : "PLANEJAMENTO TRIBUTÁRIO"}
          </div>

          <h2
            style={{
              margin:
                "4px 0",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Base da análise
          </h2>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
            }}
          >
            {empresasConsultadas} empresa(s) identificada(s).
          </div>
        </div>
      </div>

      <Card
        style={{
          marginBottom: 14,
          borderTop:
            "4px solid #31589C",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 10,
            alignItems:
              "flex-start",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div>
            <strong
              style={{
                display: "block",
                fontSize: 14,
              }}
            >
              Atividades da empresa
            </strong>

            <div
              style={{
                color: MUTED,
                fontSize: 10,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Os CNAEs vieram da consulta do CNPJ. Confirme quais atividades realmente fazem parte da operação e indique qual é a atividade principal de fato.
            </div>
          </div>

          <Botao
            secundario
            onClick={
              preencherAtividadesPadrao
            }
          >
            Selecionar CNAEs encontrados
          </Botao>
        </div>

        {!atividadesDisponiveis.length ? (
          <div
            style={{
              background:
                "#FFF8E8",
              color: "#855A09",
              borderRadius: 10,
              padding: 10,
              fontSize: 10,
            }}
          >
            Nenhum CNAE foi identificado na resposta atual da consulta. Você pode continuar e descrever a atividade manualmente abaixo.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {atividadesDisponiveis.map(
              (
                item,
                index
              ) => {
                const chave =
                  chaveAtividade(
                    item
                  );

                const selecionada =
                  atividadesSelecionadas.some(
                    (atividade) =>
                      chaveAtividade(
                        atividade
                      ) === chave
                  );

                const principal =
                  atividadePrincipalSelecionada ===
                  chave;

                return (
                  <div
                    key={`${chave}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "auto minmax(0,1fr) auto",
                      gap: 10,
                      alignItems: "center",
                      border:
                        selecionada
                          ? "1px solid #BFCBF0"
                          : "1px solid #E3E7EF",
                      background:
                        selecionada
                          ? "#F8FAFF"
                          : WHITE,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selecionada
                      }
                      onChange={() =>
                        alternarAtividade(
                          item
                        )
                      }
                    />

                    <div>
                      <strong
                        style={{
                          display: "block",
                          fontSize: 10.5,
                        }}
                      >
                        {item.codigo ||
                          "CNAE"}{" "}
                        ·{" "}
                        {item.descricao ||
                          "Atividade"}
                      </strong>

                      <div
                        style={{
                          color: MUTED,
                          fontSize: 8.5,
                          marginTop: 3,
                        }}
                      >
                        Origem Receita:{" "}
                        {item.tipo ===
                        "principal"
                          ? "CNAE principal cadastrado"
                          : "CNAE secundário cadastrado"}
                      </div>
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 9,
                        fontWeight: 900,
                        cursor:
                          selecionada
                            ? "pointer"
                            : "not-allowed",
                        opacity:
                          selecionada
                            ? 1
                            : .4,
                      }}
                    >
                      <input
                        type="radio"
                        name="atividade-principal-real"
                        disabled={
                          !selecionada
                        }
                        checked={
                          principal
                        }
                        onChange={() =>
                          setAtividadePrincipalSelecionada(
                            chave
                          )
                        }
                      />
                      Principal real
                    </label>
                  </div>
                );
              }
            )}
          </div>
        )}

        <label
          style={{
            display: "block",
            marginTop: 12,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 9.5,
              fontWeight: 900,
              marginBottom: 5,
            }}
          >
            DESCREVA O QUE A EMPRESA REALMENTE FAZ
          </span>

          <textarea
            rows={4}
            value={
              descricaoAtividadeCliente
            }
            onChange={(e) =>
              setDescricaoAtividadeCliente(
                e.target.value
              )
            }
            placeholder="Ex.: Representação comercial de equipamentos industriais, venda por comissão e intermediação B2B para empresas do Paraná e Santa Catarina."
            style={{
              ...inputStyle(),
              resize: "vertical",
              fontFamily:
                BODY_FONT,
            }}
          />
        </label>

        <div
          style={{
            marginTop: 10,
            background:
              "#EEF3FF",
            color: "#31589C",
            borderRadius: 10,
            padding: 10,
            fontSize: 9.5,
            lineHeight: 1.5,
          }}
        >
          A IA usará em conjunto: CNAE principal cadastrado, CNAEs selecionados, atividade principal real, descrição da operação, documentos e dados manuais.
        </div>
      </Card>

      <Card
        style={{
          marginBottom: 14,
        }}
      >
        <strong
          style={{
            display: "block",
            marginBottom: 10,
          }}
        >
          Como deseja fornecer os dados?
        </strong>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 10,
          }}
        >
          <ModalidadeCard
            ativa={
              modalidade ===
              "documentos"
            }
            titulo="Documentos"
            descricao="A base será formada principalmente pelos arquivos enviados."
            onClick={() =>
              setModalidade(
                "documentos"
              )
            }
          />

          <ModalidadeCard
            ativa={
              modalidade ===
              "manual"
            }
            titulo="Preenchimento manual"
            descricao="O consultor informa os dados diretamente no sistema."
            onClick={() =>
              setModalidade(
                "manual"
              )
            }
          />

          <ModalidadeCard
            ativa={
              modalidade ===
              "hibrido"
            }
            titulo="Híbrido"
            descricao="Documentos + preenchimento manual + conferência do consultor."
            destaque
            onClick={() =>
              setModalidade(
                "hibrido"
              )
            }
          />
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        {(modalidade ===
          "documentos" ||
          modalidade ===
            "hibrido") && (
          <UploadDocumentos
            arquivos={
              arquivos
            }
            setArquivos={
              setArquivos
            }
          />
        )}

        {(modalidade ===
          "manual" ||
          modalidade ===
            "hibrido") && (
          <DadosManuais
            dados={
              dadosManuais
            }
            setDados={
              setDadosManuais
            }
            tipoProjeto={
              tipoProjeto
            }
          />
        )}

        {erro && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              borderRadius: 10,
              padding: 10,
              fontSize: 10.5,
            }}
          >
            {erro}
          </div>
        )}

        <Card
          style={{
            border:
              "1px solid #C9D5F5",
            background:
              "#F8FAFF",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color:
                "#31589C",
              fontWeight: 900,
            }}
          >
            PRÓXIMA ETAPA
          </div>

          <h3
            style={{
              margin:
                "6px 0 5px",
              fontFamily:
                DISPLAY_FONT,
            }}
          >
            Revisar base antes da análise
          </h3>

          <div
            style={{
              color: MUTED,
              fontSize: 10.5,
              lineHeight: 1.55,
            }}
          >
            Continue para conferir empresas, documentos e dados manuais que formarão a base do diagnóstico tributário.
          </div>

          <Botao
            onClick={
              continuarParaAnalise
            }
            style={{
              marginTop: 12,
              background:
                "#31589C",
            }}
          >
            Continuar para análise →
          </Botao>
        </Card>
      </div>
    </div>
  );
}
