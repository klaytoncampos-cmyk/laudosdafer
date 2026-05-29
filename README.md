# Laudos da Fer — Setup completo

Gerador de laudos de ecocardiograma para Dra. Fernanda Andre Carbonieri (Santa Casa de Londrina).
Stack: **Cloudflare Pages + D1 + Functions**, sem dependências externas.

---

## Estrutura do projeto

```
laudosdafer/
├── index.html            ← UI principal
├── app.js                ← JavaScript do app
├── schema.sql            ← Estrutura do banco D1 (executar 1x)
├── wrangler.toml         ← Configuração do Cloudflare
├── package.json          ← npm scripts
├── functions/
│   ├── _utils.js         ← Helpers compartilhados (auth, hash)
│   └── api/
│       ├── auth/         ← login, logout, check
│       ├── frases/       ← CRUD biblioteca de frases
│       ├── templates/    ← templates customizados
│       ├── preferences/  ← tema, densidade, defaults
│       └── stats/        ← log de laudos + painel
└── scripts/
    └── setup-auth.js     ← Cria/redefine senha da Dra.
```

---

## Passo a passo de deploy

### 1. Pré-requisitos

Instale o `wrangler` (CLI da Cloudflare) globalmente:

```bash
npm install -g wrangler
```

Faça login:

```bash
wrangler login
```

(abre o navegador, autoriza com sua conta Cloudflare)

### 2. Criar o banco D1

```bash
wrangler d1 create laudosdafer-db
```

A saída vai mostrar algo como:

```
✅ Successfully created DB 'laudosdafer-db'
[[d1_databases]]
binding = "DB"
database_name = "laudosdafer-db"
database_id = "abc12345-6789-..."
```

**Copie o `database_id`** e cole no arquivo `wrangler.toml` substituindo `SUBSTITUIR_PELO_ID_QUE_O_WRANGLER_GERAR`.

### 3. Aplicar o schema

```bash
cd laudosdafer
wrangler d1 execute laudosdafer-db --remote --file=schema.sql
```

Vai criar todas as tabelas + popular as 18 frases prontas + preferências padrão.

### 4. Definir a senha da Dra. Fernanda

```bash
node scripts/setup-auth.js "senhaQueQuiserAqui"
```

Ou interativo (sem passar como argumento):

```bash
node scripts/setup-auth.js
```

O script gera hash PBKDF2 + salt aleatório e insere no D1. Se ela esquecer a senha, basta rodar de novo com uma senha nova.

### 5. Criar o repositório GitHub

```bash
cd laudosdafer
git init
git add .
git commit -m "Laudos da Fer V3 inicial"
gh repo create klaytoncampos-cmyk/laudosdafer --public --source=. --push
```

(ou crie o repo manualmente no GitHub e faça `git push`)

### 6. Conectar ao Cloudflare Pages

1. Acesse [https://dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create application → Pages → **Connect to Git**
2. Selecione o repo `klaytoncampos-cmyk/laudosdafer`
3. Configurações de build:
   - **Build command**: (deixe vazio)
   - **Build output directory**: `.` (ponto)
   - **Framework preset**: None
4. Clique em **Save and Deploy**

### 7. Conectar o D1 ao Pages

**Esta é a etapa crítica.** Sem isso, as Functions não conseguem ler o banco.

1. Após o deploy terminar, vá em **Settings** do projeto Pages
2. Em **Functions** → **D1 database bindings** → **Add binding**
3. Configure:
   - **Variable name**: `DB`
   - **D1 database**: `laudosdafer-db`
4. Em **Save** — depois faça um **novo deploy** (basta um commit vazio):

```bash
git commit --allow-empty -m "Trigger redeploy para D1 binding"
git push
```

### 8. Pronto

A URL vai ser `https://laudosdafer.pages.dev`.

Manda pra Dra. Fernanda com a senha que você configurou no passo 4.

---

## Manutenção

### Redefinir senha
```bash
node scripts/setup-auth.js "novaSenha"
```

### Atualizar o código
```bash
git add . && git commit -m "ajuste X" && git push
```
Cloudflare Pages faz auto-deploy em ~30 segundos.

### Adicionar frases novas direto no banco
```bash
wrangler d1 execute laudosdafer-db --remote --command "INSERT INTO frases (categoria, texto, builtin, created_at) VALUES ('outras', 'Texto da frase aqui', 1, strftime('%s','now')*1000);"
```

Ou a Dra. Fernanda mesma adiciona pela UI (botão **📚 Frases**).

### Backup do banco
```bash
wrangler d1 export laudosdafer-db --remote --output=backup.sql
```

### Ver últimos laudos registrados (stats)
```bash
wrangler d1 execute laudosdafer-db --remote --command "SELECT created_at, tipo, alterado, feve, psap FROM laudo_log ORDER BY id DESC LIMIT 20;"
```

---

## Desenvolvimento local

Para testar antes de deploy:

```bash
# aplicar schema no banco local
wrangler d1 execute laudosdafer-db --local --file=schema.sql

# rodar localmente
wrangler pages dev . --d1=DB=laudosdafer-db
```

Abre em `http://localhost:8788`.

---

## O que tem nessa versão

**Novidades V5 (revisão dos laudos do Hospital Evangélico — chefe da Dra. Fernanda):**

*Decisão:* desses laudos foram extraídos apenas **padrões e vocabulário** (as duas médicas usam o mesmo). O formato do Evangélico (tabela de medidas/referência) foi descartado — o app continua gerando só no formato da Dra. Fernanda (Santa Casa).

*Valva mitral:*
- **Escore de Wilkins** (estenose reumática): 4 subscores 0–4 (mobilidade, subvalvar, folhetos, calcificação) + soma automática → "Escore Wilkins: X (mobilidade=a; subvalvar=b; folhetos=c; calcificacao=d)"
- **Morfologia reumática**: "abertura em domo da cúspide anterior e mobilidade reduzida da cúspide posterior" + "Presença de fusão comissural"
- Refluxo **(secundário)** (funcional) e quantificação por **vena contracta** (mm)

*Valva aórtica:*
- **Abertura em domo** (substitui o fecho "abertura e mobilidade preservadas")
- **Pontos de calcificação** como qualificador separado de "calcificadas"

*Aorta torácica:*
- Seletor de termo **Dilatação / Ectasia** (nunca "Aumento") — aplica no corpo e na conclusão
- Ateromatose calcificada da aorta descendente · Espessamento da camada íntima

*Ventrículo esquerdo:*
- **Morfologia do septo IV**: sigmoide / movimentação assincrônica (marcapasso) / retificado (sobrecarga pressórica à direita)

*Ventrículo direito:*
- Campo **onda S'** (cm/s) ao lado do TAPSE

*Septos:*
- **Septo interatrial**: redundante / hipertrofia lipomatosa / aneurismático

*Achados adicionais:*
- **Trombo / massa intracavitária** com dimensões (texto livre — antes só havia ausência/presença)
- **Derrame pleural** (esq. / dir. / bilateral) como achado extracardíaco

*Correção de bug:* o checkbox de refluxo secundário da mitral estava com `name` mas era lido por `getElementById` — nunca teria funcionado; corrigido para `id`.

*Adiado para revisão da Dra. Fernanda (não implementado):* **ETE isolado** como exame próprio (hoje só existe como complementação do transtorácico) e **pesquisa de FOP com medidas do forame** — são estrutura nova grande, melhor validar o desenho antes.

---

## Versão anterior (V4)

**Novidades V4 (revisão de 54+ laudos reais dela):**

*Estrutura:*
- Bullseye SVG → **chips em 2 colunas** (basal/médio/apical) com seletor de estado global
- TAVI consolidado como subtipo dentro de **Prótese** (Mecânica/Biológica/TAVI)
- Toggle **ETT / ETT+ETE** no topo da tela
- Seção **ETE completa** (drenagem das veias, apêndice atrial, trombos, vegetação) com 2 variantes de título ("transesofágica" / "esofágica")

*Valvopatias detalhadas:*
- Campo **Grad. máximo** + Grad. médio nas 4 valvas com medidas (VM nativa, VA nativa, prót. VM, prót. VA)
- Prefixo de gradiente (sistólico / diastólico / AE-VE / sem prefixo)
- Método da área valvar (PHT / Equação de Continuidade)
- **Graus intermediários** (discreto a moderado, moderado a importante) em refluxos e HVE
- Detecção automática de **"Dupla lesão valvar"** (estenose + refluxo na mesma valva) com concordância gramatical correta
- Causa do refluxo na tricúspide (funcional / sec. dilatação do anel)
- **Hipocinesia/Acinesia/Discinesia/Aneurisma difuso do VE** detectado automaticamente quando todos os 17 segmentos têm o mesmo estado

*Endocardite e vegetações:*
- Disjunção do anel valvar
- Prolapso de ambas as cúspides → frase específica "Presença de prolapso de ambas as cúspides..."
- **Vegetação algodonosa filamentar** com tamanho
- **Medidas por cúspide** (anterior/posterior) para espessamento de margens livres
- Calcificação do anel mitral com grau (discreta/moderada/importante/sem grau)

*Frases especiais novas:*
- **Pesquisa de shunt com contraste salino (microbolhas)** — positiva / negativa
- Shunt em lâmina pós-ablação (variante de FOP)
- "Há sinais de aumento das pressões de enchimento" (checkbox)
- "Fluxo e pulsatilidade normais" na aorta (HA secundária)
- "Exame beira-leito" como linha em DADOS DESCRITIVOS
- HVE descritiva ("Aumento moderado e simétrico da espessura miocárdica")

*Diastólica:*
- Padrão diastólico **não avaliado** devido ao marcapasso
- Padrão diastólico **não avaliado** devido à valvopatia mitral

*Ritmo:*
- Sinusal com arritmias paroxísticas durante o exame
- Regular com extrassístoles frequentes
- Regular, taquicárdico
- (totalizando 9 opções)

---

**Correções da revisão dos 22 laudos reais dela:**
- Aorta usa "Dilatação"/"Ectasia" (não "Aumento")
- PSAP fica na Valva Pulmonar
- AD sem "do átrio direito"
- HVE simplificada ("Hipertrofia concêntrica discreta.")
- Diastólica curta ("Disfunção diastólica grau I.")
- Cavidade VE com ordem invertida ("Aumento discreto da cavidade...")
- Motilidade com "Contratilidade preservada nas demais paredes"
- Grau "Refluxo mínimo" adicionado
- Pericárdio com mm + homogêneo + variante laminar
- Aorta ascendente com medida inline opcional

**Adições:**
- FC (bpm) junto com ritmo
- Janela acústica limitada / muito limitada
- FEVE por Teicholz como alternativa
- VD com observação de marcapasso/eletrodos/CVC
- VM com cúspide alongada, abertura preservada, refluxo excêntrico
- VCI como linha solta após Septo (toggle incluir/omitir)

**Interatividade:**
- Sugestões contextuais inline (chips violeta) por seção
- Conditional fields (campos aparecem só quando precisam)
- Conclusão guiada (sugestões clicáveis que vão pra recom/conclusão)
- Templates por indicação (5 templates)
- "Tudo normal" em 1 clique

**D1 integration:**
- Frases pessoais sincronizadas entre dispositivos
- Reordenação automática por uso (mais usadas no topo)
- Templates customizados salvos
- Preferências (tema, densidade) persistentes
- Stats: total de laudos, % normais, FEVE média, frases mais usadas

**Layout:**
- Sidebar de navegação com status por seção (✓/⚠)
- Sticky patient header (indicação, sexo, ritmo, FEVE, PSAP)
- FAB de copiar laudo (sempre visível)
- Dark mode + density toggle
- Modal de estatísticas
- Auto-classificação pelas medidas (cortes ASE + tabela da Dra.)

**Auth:**
- PBKDF2 + salt aleatório (100k iterações)
- Cookie HttpOnly + Secure + SameSite=Strict
- Sessão de 30 dias
- 100% no D1, sem dependências externas

---

## Suporte / problemas comuns

**"Auth não configurada"** → rode `node scripts/setup-auth.js` (passo 4).
**"Erro 500 nas APIs"** → verifique o binding D1 (passo 7).
**Frases não aparecem** → confira que o schema foi aplicado (passo 3).
**Login não funciona** → verifique que cookies estão habilitados no navegador da Dra.
