# Diagnóstico Empresarial — protótipo do evento

## Colocar online (sem escrever código)

### Opção A — mais fácil: Vercel pelo site
1. Crie uma conta grátis em https://vercel.com (dá pra entrar com GitHub, GitLab ou e-mail).
2. Crie um repositório no GitHub e suba esta pasta inteira nele
   (pelo próprio site do GitHub: "Add file" → "Upload files", arrasta tudo).
3. Na Vercel, clique em "Add New" → "Project", selecione o repositório.
4. A Vercel detecta automaticamente que é um projeto Vite. Clique em "Deploy".
5. Em ~1 minuto você recebe uma URL do tipo `evento-diagnostico.vercel.app` — é esse link que vai no QR code.

### Opção B — pelo terminal (se tiver Node.js instalado)
```bash
npm install -g vercel
cd evento-diagnostico
npm install
vercel
```
Siga as perguntas na tela (aceitar os padrões funciona). No final ele imprime a URL pública.

## Rodar localmente para testar antes de publicar
```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`.

## Domínio próprio
Depois de publicado, em Project → Settings → Domains na Vercel dá pra apontar
um domínio próprio (ex: `diagnostico.suaempresa.com.br`) em vez do link `.vercel.app`.

## Próximo passo: dados reais

Este projeto já vem com CNPJ real e IA real integrados via funções na pasta `/api`:

- `api/cnpj.js` — consulta a BrasilAPI (gratuita, sem chave) e infere o segmento
  (Serviço/Comércio/Indústria) pela divisão do CNAE.
- `api/diagnostico.js` — chama a API da Anthropic (Claude) para gerar os riscos
  e as recomendações de cada área, com base nas respostas do checklist.

### Configurar a chave da IA na Vercel
1. No painel do projeto na Vercel, vá em **Settings → Environment Variables**.
2. Adicione uma variável chamada `ANTHROPIC_API_KEY` com sua chave da API da Anthropic
   (gerada em https://console.anthropic.com — aba "API Keys").
3. Marque para os ambientes Production e Preview.
4. Clique em **Redeploy** (Deployments → ⋯ → Redeploy) para a variável entrar em vigor.

Sem essa variável configurada, o app continua funcionando normalmente — ele
detecta a falha e volta automaticamente para o modo simulado (mock), então
nada quebra durante os testes.

### Rodando localmente com as funções de API
```bash
npm install -g vercel
vercel dev
```
O `vercel dev` sobe tanto o front-end quanto as funções da pasta `/api` juntos,
simulando o ambiente de produção. Copie `.env.example` para `.env` e preencha
sua chave antes de rodar.

