# Welcome to your Lovable project

> AVISO: Este diretório é uma cópia antiga. O desenvolvimento está centralizado no diretório raiz `../`.

Para desenvolver e executar a aplicação, utilize o README do diretório raiz e rode os comandos a partir de `c:\projetos\projeto_lovable\agro-plan-assist`.

## Project info

**URL**: https://lovable.dev/projects/f7deb657-6563-48cc-82f2-fabdd72fc8dc

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f7deb657-6563-48cc-82f2-fabdd72fc8dc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/f7deb657-6563-48cc-82f2-fabdd72fc8dc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Arquitetura de Dados (Supabase)

Este projeto utiliza Supabase para autenticação, banco de dados e regras de segurança (RLS). Para executar localmente:

1. Configure as variáveis no `.env` do frontend:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID` (opcional)
2. Certifique-se de aplicar as migrações do diretório `supabase/migrations` no seu projeto Supabase.
3. Inicie o frontend com `npm run dev` (porta padrão `5173`).

Observação: O backend Oracle é opcional/legado e não é necessário para o funcionamento padrão. Se desejar utilizá-lo, consulte o diretório `backend/` e ajuste por conta própria.
