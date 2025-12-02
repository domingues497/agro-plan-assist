# Agro Plan Assist

Aplicação web para planejamento de sementes, fertilizantes e controle de defensivos.

Frontend em React/Vite e backend em Flask, com banco de dados PostgreSQL.

## Tecnologias

- Vite, React, TypeScript, Tailwind, shadcn-ui
- Flask (API) com `flask-cors`
- PostgreSQL via `psycopg2-binary`

## Pré-requisitos

- Node.js 18+ e npm
- Python 3.11+ e pip
- PostgreSQL (local ou remoto)

## Ambiente de desenvolvimento

1. Frontend
   - Instalar dependências: `npm install`
   - Rodar em desenvolvimento: `npm run dev` (porta `5173`)
   - Visualizar build: `npm run build` e `npm run preview`

2. Backend (API Flask)
   - Criar ambiente virtual: `python -m venv venv`
   - Instalar dependências: `./venv/Scripts/pip install -r server/requirements.txt`
   - Configurar conexão com PostgreSQL via variáveis de ambiente:
     - `AGROPLAN_DB_NAME` (padrão `agroplan_assist`)
     - `AGROPLAN_DB_USER` (padrão `agroplan_user`)
     - `AGROPLAN_DB_PASS` (padrão `agroplan_pass`)
     - `AGROPLAN_DB_HOST` (padrão `localhost`)
     - `AGROPLAN_DB_PORT` (padrão `5432`)
   - Iniciar API: `./venv/Scripts/python.exe server/app.py` (porta `5000`)

## Variáveis do frontend

- `VITE_API_URL` (opcional): URL base da API. Se não definido, usa o host atual e porta `5000`.
- `VITE_HMR_HOST` (opcional): host público do HMR quando usando proxy reverso.

## Proxy reverso (desenvolvimento interno)

- Encaminhar o domínio para o dev server (`192.168.x.x:5173`) e rotear chamadas da API para a Flask (`127.0.0.1:5000`).
- Garantir suporte a WebSocket/HMR no proxy e cabeçalhos de upgrade.

## Scripts úteis

- `npm run dev` — inicia o frontend
- `npm run build` — gera build de produção
- `npm run preview` — serve o build gerado
- `npm run lint` — checa o código do frontend

## Observações

- O backend cria/garante automaticamente o schema necessário no PostgreSQL ao iniciar.
- Ports padrão: frontend `5173`, API `5000`. Ajuste conforme necessário.

## Regras de Negócio

- Exclusividade de Programação por talhão e safra (mesma fazenda)
  - Ao criar/atualizar uma Programação, nenhum dos talhões selecionados pode já estar vinculado a outra Programação na mesma safra da mesma fazenda.
  - Bloqueio na API com erro 400 e retorno dos nomes dos talhões em conflito; o frontend exibe mensagem amigável.
  - Restrição garantida por índice único em `programacao_talhoes (fazenda_idfazenda, talhao_id, safra_id)`.

- Exclusão bloqueada quando há defensivos
  - Não é permitido excluir uma Programação se existirem registros de defensivos para a mesma fazenda/área e safra.
  - O botão de excluir fica desabilitado quando detectado; a API também bloqueia e retorna erro 400 com quantidade de defensivos e nomes dos talhões.

- Cadastro de defensivos condicionado à Programação de Cultivar
  - Somente é possível cadastrar aplicações de defensivos se existir Programação de Cultivar para o produtor e fazenda na safra selecionada.

- Regras de defensivos na fazenda
  - O mesmo produto não pode ser repetido sem marcar a flag "Produto salvo" no item anterior.
  - Cálculo do total por item: `dose × área(ha) × cobertura(%)`.
  - Quando possível, a classe é inferida pela aplicação/"alvo"; cada item persiste `safra_id`.

- Replicação de defensivos
  - Replicação só permite destinos que possuam Programação de Cultivar e Adubação na mesma safra.
  - O par origem (produtor/fazenda da aplicação selecionada) não é listado como destino.

- Pré-requisitos para Programação
  - Programação exige fazenda/área cadastrada e `safra_id` definido.
  - Talhões associados a uma Programação pertencem à fazenda informada e respeitam a restrição de exclusividade por safra.
