# Boy Awards ★

Site de votação entre amigos, visual neon, categorias anuais, códigos individuais e revelação dos vencedores.

## O que funciona

- Página inicial responsiva, categorias e Hall da Fama.
- Voto por código individual: **uma vez por categoria**.
- Painel de administrador (categorias, indicados, emissão de códigos e apuração).
- Resultado secreto até a revelação; empate exige escolha manual do administrador.
- Histórico por edição (`edition`), com edição padrão configurável.
- **Demo local** com dados falsos quando o Supabase ainda não foi configurado.

## Testar agora (sem banco)

Abra `index.html` em um navegador ou use um servidor estático local:

```bash
python -m http.server 8000
```

Visite `http://localhost:8000`. Na demonstração, os dados são salvos somente no `localStorage` deste navegador. Use o código `DEMO-2027-A` e abra o botão **Painel → Entrar como administrador de demonstração** para criar categorias ou indicados. Este modo **não** serve para votos reais compartilhados.

## Ativar o Supabase para votação real

1. Crie um projeto gratuito no [Supabase](https://supabase.com/).
2. Abra **SQL Editor** e execute todo o arquivo `supabase.sql` **uma única vez** em um projeto novo. Se executar duas vezes, as políticas/triggers já existentes gerarão erro.
3. Em **Authentication → Users**, crie manualmente um usuário administrador de e-mail/senha e confirme o e-mail quando necessário. Copie o UUID desse usuário.
4. Execute no SQL Editor:

   ```sql
   insert into public.admins (user_id)
   values ('UUID-DO-SEU-USUARIO');
   ```

5. Em **Project Settings → API / Data API**, copie a **Project URL** e a chave **publishable** (`sb_publishable_...`) ou a chave pública legada `anon`. Preencha `config.js`:

   ```js
   window.BOY_AWARDS_CONFIG = {
     supabaseUrl: 'https://SEU-PROJETO.supabase.co',
     supabaseAnonKey: 'SUA_CHAVE_PUBLICA',
     defaultEdition: '2027'
   };
   ```

6. Recarregue a página. Agora os dados e os votos são compartilhados por todos os dispositivos. Entre no painel com o administrador, crie categorias e indicados, gere os códigos e distribua **um código diferente para cada amigo**. O arquivo do frontend **jamais** deve conter a chave secreta `service_role` ou `sb_secret`.
7. Feche a votação da categoria no painel antes de revelar seu vencedor. No caso de empate, o administrador escolhe o desempate manualmente.

**Segurança:** os códigos reais são gerados com aleatoriedade criptográfica pelo PostgreSQL, armazenados como hashes SHA-256 e verificados dentro de uma função no banco; a tabela de votos não oferece escrita pública direta. Recarregar a página não contorna a restrição por código e categoria. **Limite:** não há rate limiting específico contra tentativas automatizadas no RPC; habilite proteção antiabuso antes de uma divulgação pública ampla. Também é importante que os códigos sejam distribuídos em privado e não compartilhados pelos participantes.

## Publicar grátis no GitHub Pages

1. Crie um repositório no GitHub (ex.: `boy-awards`).
2. Envie `index.html`, `styles.css`, `app.js` e `config.js` para a raiz do repositório. **Não é necessário publicar o SQL ou README**, embora você possa mantê-los versionados.
3. Vá em **Settings → Pages → Build and deployment** e escolha **Deploy from a branch → main → /(root)**. Salve.
4. O endereço será semelhante a `https://SEU-USUARIO.github.io/boy-awards/`.
5. Adicione esse domínio à configuração de URL do Supabase Auth, se necessário para seus fluxos de autenticação. O login por senha usado aqui não utiliza redirecionamento de OAuth.

O GitHub Pages publica arquivos estáticos; o Supabase guarda dados e votos. O projeto do Supabase gratuito pode pausar se ficar inativo por muito tempo: revise seu status antes da premiação anual.

## Próximas melhorias possíveis

- Tela de apresentação para revelar vencedores em um telão.
- Cadastro de indicados com fotos.
- Várias edições com seletor público e edição arquivada.
- Importação/exportação de resultados e códigos.
- Proteção antiabuso com rate limiting ou CAPTCHA em endpoint apropriado.

## Estrutura

```
boy-awards/
├── index.html       # Interface e formulários
├── styles.css       # Identidade visual neon e layout responsivo
├── app.js           # Interface, admin, modo demo e conexão Supabase
├── config.js        # URL e chave pública do Supabase (sem segredos)
├── supabase.sql     # Tabelas, RLS e funções de voto seguro
└── README.md        # Este guia
```


### Correção da versão 1.1
O `app.js` agora é carregado como script clássico (`defer`), permitindo testar o modo de demonstração ao abrir `index.html` diretamente pelo navegador (`file://`). Para uso com Supabase, recomenda-se hospedar no GitHub Pages ou rodar um servidor local.
