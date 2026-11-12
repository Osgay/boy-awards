const cfg=window.BOY_AWARDS_CONFIG||{};
const demo=!(cfg.supabaseUrl&&cfg.supabaseAnonKey);
const edition=String(cfg.defaultEdition||'2027');
const $=(sel)=>document.querySelector(sel);
const esc=(value)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid=()=>globalThis.crypto?.randomUUID?.()||`demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const seed=()=>({categories:[
{id:'c1',title:'Maior Sumido',description:'Promete aparecer, mas some mais rápido que o Wi-Fi.',edition,emoji:'👻',voting_open:true,created_at:'2027-01-01'},
{id:'c2',title:'Rei do Migué',description:'A desculpa mais criativa sempre vem dessa pessoa.',edition,emoji:'🎭',voting_open:true,created_at:'2027-01-02'},
{id:'c3',title:'Maior Comédia',description:'Impossível passar cinco minutos sem virar meme.',edition,emoji:'🤡',voting_open:true,created_at:'2027-01-03'},
{id:'c4',title:'Casal do Ano',description:'A dupla que mais deu assunto no grupo.',edition,emoji:'💘',voting_open:true,created_at:'2027-01-04'},
{id:'c5',title:'Lenda do Rolê',description:'Uma pessoa, mil histórias e nenhuma prova.',edition,emoji:'🔥',voting_open:true,created_at:'2027-01-05'},
{id:'c6',title:'Maior Fanfarrão',description:'O caos tem nome e sobrenome.',edition,emoji:'🕺',voting_open:true,created_at:'2027-01-06'}],
nominees:[
{id:'n1',category_id:'c1',name:'Boy A'},{id:'n2',category_id:'c1',name:'Boy B'},{id:'n3',category_id:'c2',name:'Boy C'},{id:'n4',category_id:'c2',name:'Boy A'},
{id:'n5',category_id:'c3',name:'Boy B'},{id:'n6',category_id:'c3',name:'Boy D'},{id:'n7',category_id:'c4',name:'Dupla A'},{id:'n8',category_id:'c4',name:'Dupla B'},
{id:'n9',category_id:'c5',name:'Boy C'},{id:'n10',category_id:'c5',name:'Boy D'},{id:'n11',category_id:'c6',name:'Boy A'},{id:'n12',category_id:'c6',name:'Boy C'}],
winners:[],ballots:[],codes:['DEMO-2027-A','DEMO-2027-B','DEMO-2027-C'],adminEnabled:false});
let data={categories:[],nominees:[],winners:[],ballots:[],codes:[],adminEnabled:false};
let client=null,admin=false,session=null,activeVote=null,recentCodes=[];
function saveDemo(){if(demo)localStorage.setItem('boy-awards-demo-v1',JSON.stringify(data));}
function loadDemo(){try{const parsed=JSON.parse(localStorage.getItem('boy-awards-demo-v1'));data=parsed&&Array.isArray(parsed.categories)?parsed:seed();}catch{data=seed();}saveDemo();}
const notify=(message)=>{const t=$('#toast');t.textContent=message;t.classList.add('shown');clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>t.classList.remove('shown'),3800);};
const errText=(err)=>err?.message||String(err);
function selectNominees(categoryId){return data.nominees.filter(n=>n.category_id===categoryId);}
function showDemoBanner(){const b=$('#mode-banner');b.hidden=!demo;if(demo)b.innerHTML='<strong>MODO DE DEMONSTRAÇÃO</strong> — Dados e votos ficam apenas neste navegador; não são compartilhados entre seus amigos. Código de teste: <strong>DEMO-2027-A</strong>. Para ativar votação real, configure o Supabase.';}
function renderPublic(){
 $('#edition-label').textContent=`EDIÇÃO ${edition}`;$('#year').textContent=new Date().getFullYear();
 $('#stats-categories').textContent=String(data.categories.filter(c=>c.edition===edition).length).padStart(2,'0');
 $('#stats-nominees').textContent=String(data.nominees.filter(n=>data.categories.some(c=>c.id===n.category_id&&c.edition===edition)).length).padStart(2,'0');
 const cats=data.categories.filter(c=>c.edition===edition).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
 $('#category-grid').innerHTML=cats.length?cats.map(c=>{const ns=selectNominees(c.id);const open=c.voting_open&&ns.length>0;return `<article class="category-card"><div class="card-top"><span class="category-emoji">${esc(c.emoji||'🏆')}</span><span class="status ${c.voting_open?'':'closed'}">${c.voting_open?'● VOTAÇÃO ABERTA':'● ENCERRADA'}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.description||'Quem merece levar esse prêmio?')}</p><div class="card-foot"><span class="nominee-count">✦ ${ns.length} INDICADO${ns.length!==1?'S':''}</span><button class="vote-open" data-vote-category="${esc(c.id)}" ${open?'':'disabled'}>${open?'VOTAR ↗':ns.length?'ENCERRADA':'SEM INDICADOS'}</button></div></article>`;}).join(''):'<div class="empty">Nenhuma categoria nesta edição ainda. Abra o painel para criar a primeira!</div>';
 const winners=data.winners.map(w=>({...w,category:data.categories.find(c=>c.id===w.category_id),nominee:data.nominees.find(n=>n.id===w.nominee_id)})).filter(w=>w.category&&w.nominee).sort((a,b)=>String(b.category.edition).localeCompare(String(a.category.edition)));
 $('#winner-grid').innerHTML=winners.length?winners.map(w=>`<article class="winner-card"><span>🏆 EDIÇÃO ${esc(w.category.edition)} — VENCEDOR</span><h3>${esc(w.category.title)}</h3><p>★ ${esc(w.nominee.name)}</p></article>`).join(''):'<div class="empty">Os vencedores ainda são um segredo. Depois da revelação, o Hall da Fama aparece aqui.</div>';
}
function showDialog(id){const d=document.getElementById(id);if(!d.open)d.showModal();}
function hideDialog(id){document.getElementById(id).close();}
function openVote(categoryId){const cat=data.categories.find(c=>c.id===categoryId);if(!cat||!cat.voting_open)return;const ns=selectNominees(categoryId);if(!ns.length)return;activeVote={categoryId,nomineeId:null};$('#vote-target').innerHTML=`<strong>${esc(cat.emoji||'🏆')} ${esc(cat.title)}</strong><p style="margin-bottom:8px;color:#c8badc;font-size:12px">Escolha seu indicado:</p><div id="vote-options" style="display:grid;gap:7px">${ns.map(n=>`<label style="display:flex;align-items:center;gap:9px;font-size:13px;padding:7px"><input type="radio" name="nominee" value="${esc(n.id)}" required> ${esc(n.name)}</label>`).join('')}</div>`;$('#vote-error').textContent='';$('#voter-code').value='';showDialog('vote-dialog');}
async function submitVote(event){event.preventDefault();if(!activeVote)return;const checked=$('#vote-form input[name="nominee"]:checked');const code=$('#voter-code').value.trim().toUpperCase();const msg=$('#vote-error');if(!checked){msg.textContent='Selecione um indicado.';return;}if(!code){msg.textContent='Informe seu código individual.';return;}const submit=$('#vote-submit');submit.disabled=true;submit.textContent='REGISTRANDO...';try{
 if(demo){if(!data.codes.includes(code))throw Error('Código inválido. No demo, use DEMO-2027-A, DEMO-2027-B ou DEMO-2027-C.');if(data.ballots.some(b=>b.category_id===activeVote.categoryId&&b.code===code))throw Error('Este código já votou nesta categoria.');data.ballots.push({category_id:activeVote.categoryId,nominee_id:checked.value,code});saveDemo();}
 else{const{error}=await client.rpc('cast_vote',{p_category_id:activeVote.categoryId,p_nominee_id:checked.value,p_code:code});if(error)throw error;}
 hideDialog('vote-dialog');notify('Seu voto foi registrado! ★');if(admin)await refreshAdmin();
 }catch(e){msg.textContent=errText(e);}finally{submit.disabled=false;submit.textContent='CONFIRMAR MEU VOTO ↗';}}
function adminVisibility(){const logged=admin;$('#admin-login').hidden=logged;$('#admin-content').hidden=!logged;$('#logout-btn').hidden=!logged;$('#demo-admin-btn').hidden=!demo;$('#login-form').hidden=demo;}
async function checkAdmin(){if(demo){admin=Boolean(data.adminEnabled);adminVisibility();return;}const{data:auth}=await client.auth.getSession();session=auth.session;admin=false;if(session){const{data:row,error}=await client.from('admins').select('user_id').eq('user_id',session.user.id).maybeSingle();if(!error&&row)admin=true;}adminVisibility();}
async function refreshData(){if(demo){renderPublic();return;}
 const results=await Promise.all([client.from('categories').select('*').order('created_at'),client.from('nominees').select('*').order('created_at'),client.from('winners').select('*')]);
 for(const r of results)if(r.error)throw r.error;
 [data.categories,data.nominees,data.winners]=results.map(r=>r.data||[]);renderPublic();}
async function refreshAdmin(){if(!admin)return;renderCategoryAdmin();await renderResults();}
function renderCategoryAdmin(){const cats=[...data.categories].sort((a,b)=>String(b.edition).localeCompare(String(a.edition)));$('#admin-category-list').innerHTML=cats.length?cats.map(c=>`<div class="admin-list-item"><strong>${esc(c.emoji||'🏆')} ${esc(c.title)} <small>(${esc(c.edition)})</small></strong><small>${selectNominees(c.id).length} indicado(s) · ${c.voting_open?'Aberta':'Fechada'}</small><div class="admin-item-actions"><button data-edit-cat="${esc(c.id)}">Editar</button><button data-list-nominees="${esc(c.id)}">Gerenciar indicados</button><button data-delete-cat="${esc(c.id)}">Excluir</button></div></div>`).join(''):'<p class="dimmed">Nenhuma categoria.</p>';
}
function editCategory(id){const c=data.categories.find(c=>c.id===id);if(!c)return;$('#edit-category-id').value=c.id;$('#cat-title').value=c.title;$('#cat-description').value=c.description||'';$('#cat-edition').value=c.edition;$('#cat-emoji').value=c.emoji||'';$('#cat-open').checked=c.voting_open;$('#save-category-btn').textContent='ATUALIZAR CATEGORIA';$('#cancel-edit').hidden=false;$('#admin-categories').scrollTop=0;}
function resetCategory(){ $('#category-form').reset();$('#edit-category-id').value='';$('#cat-edition').value=edition;$('#cat-open').checked=true;$('#save-category-btn').textContent='SALVAR CATEGORIA';$('#cancel-edit').hidden=true;}
async function saveCategory(event){event.preventDefault();const id=$('#edit-category-id').value;const payload={title:$('#cat-title').value.trim(),description:$('#cat-description').value.trim(),edition:$('#cat-edition').value.trim(),emoji:$('#cat-emoji').value.trim()||'🏆',voting_open:$('#cat-open').checked};if(!payload.title||!payload.edition)return;try{if(demo){if(id)Object.assign(data.categories.find(c=>c.id===id),payload);else data.categories.push({id:uid(),created_at:new Date().toISOString(),...payload});saveDemo();}else{const op=id?client.from('categories').update(payload).eq('id',id):client.from('categories').insert(payload);const{error}=await op;if(error)throw error;}resetCategory();await refreshData();await refreshAdmin();notify('Categoria salva!');}catch(e){$('#admin-feedback').textContent=errText(e);}}
let activeNomineesCategoryId=null;
function openNomineesManager(categoryId){
 const cat=data.categories.find(c=>c.id===categoryId);
 if(!cat)return;
 activeNomineesCategoryId=categoryId;
 $('#nominees-category-name').textContent=`${cat.emoji||'🏆'} ${cat.title} · edição ${cat.edition}`;
 $('#nominee-name').value='';
 $('#nominee-feedback').textContent='';
 renderNomineesManager();
 showDialog('nominees-dialog');
 $('#nominee-name').focus();
}
function renderNomineesManager(){
 if(!activeNomineesCategoryId)return;
 const nominees=selectNominees(activeNomineesCategoryId);
 $('#nominees-list').innerHTML=nominees.length?nominees.map((n,i)=>`<div class="nominee-row"><div class="nominee-avatar">${i+1}</div><div class="nominee-details"><strong>${esc(n.name)}</strong><small>Indicado #${i+1}</small></div><button class="nominee-remove" type="button" data-remove-nominee="${esc(n.id)}" aria-label="Excluir ${esc(n.name)}">Excluir</button></div>`).join(''):'<div class="nominees-empty">Ainda não há indicados. Adicione o primeiro acima.</div>';
}
async function saveNominee(event){
 event.preventDefault();
 if(!admin||!activeNomineesCategoryId)return;
 const name=$('#nominee-name').value.trim();
 const feedback=$('#nominee-feedback');
 feedback.textContent='';
 if(!name)return;
 if(selectNominees(activeNomineesCategoryId).some(n=>n.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){feedback.textContent='Este nome já está na categoria.';return;}
 const button=$('#nominee-form button[type="submit"]');button.disabled=true;
 try{
  if(demo){data.nominees.push({id:uid(),category_id:activeNomineesCategoryId,name,created_at:new Date().toISOString()});saveDemo();}
  else{const{error}=await client.from('nominees').insert({category_id:activeNomineesCategoryId,name});if(error)throw error;}
  await refreshData();await refreshAdmin();renderNomineesManager();$('#nominee-name').value='';$('#nominee-name').focus();notify('Indicado adicionado!');
 }catch(e){feedback.textContent=errText(e);}finally{button.disabled=false;}
}
async function removeNominee(id){
 if(!admin||!activeNomineesCategoryId)return;
 const nominee=data.nominees.find(n=>n.id===id&&n.category_id===activeNomineesCategoryId);
 if(!nominee)return;
 if(!confirm(`Excluir o indicado "${nominee.name}"? Os votos e resultados associados podem ser afetados. Esta ação não pode ser desfeita.`))return;
 const feedback=$('#nominee-feedback');feedback.textContent='';
 try{
  if(demo){data.nominees=data.nominees.filter(n=>n.id!==id);data.ballots=data.ballots.filter(b=>b.nominee_id!==id);data.winners=data.winners.filter(w=>w.nominee_id!==id);saveDemo();}
  else{const{error}=await client.from('nominees').delete().eq('id',id);if(error)throw error;}
  await refreshData();await refreshAdmin();renderNomineesManager();notify('Indicado excluído.');
 }catch(e){feedback.textContent=errText(e);}
}
async function deleteCategory(id){const c=data.categories.find(c=>c.id===id);if(!c||!confirm(`Excluir "${c.title}" e todos os seus indicados/votos? Esta ação não pode ser desfeita.`))return;try{if(demo){data.categories=data.categories.filter(x=>x.id!==id);const ns=data.nominees.filter(n=>n.category_id===id).map(n=>n.id);data.nominees=data.nominees.filter(n=>n.category_id!==id);data.ballots=data.ballots.filter(b=>b.category_id!==id);data.winners=data.winners.filter(w=>w.category_id!==id);saveDemo();}else{const{error}=await client.from('categories').delete().eq('id',id);if(error)throw error;}await refreshData();await refreshAdmin();notify('Categoria excluída.');}catch(e){notify(errText(e));}}
function formatCode(code){return code.replace(/(.{5})/g,'$1-').replace(/-$/,'');}
async function generateCodes(event){event.preventDefault();const count=Number($('#code-count').value);if(!Number.isInteger(count)||count<1||count>100){notify('Escolha entre 1 e 100 códigos.');return;}try{let codes=[];if(demo){codes=Array.from({length:count},()=>`DEMO-${Math.random().toString(36).slice(2,7).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`);data.codes.push(...codes);saveDemo();}else{const{data:rows,error}=await client.rpc('admin_create_codes',{p_count:count});if(error)throw error;codes=(rows||[]).map(r=>r.code);}recentCodes=codes;$('#generated-codes').innerHTML=codes.map(code=>`<code>${esc(code)}</code>`).join('');$('#copy-codes').hidden=!codes.length;notify(`${codes.length} código(s) gerado(s). Salve agora!`);}catch(e){notify(errText(e));}}
async function renderResults(){if(!admin)return;let counts=[];if(demo){counts=data.nominees.map(n=>({category_id:n.category_id,nominee_id:n.id,total:data.ballots.filter(b=>b.nominee_id===n.id).length}));}else{const{data:rows,error}=await client.rpc('admin_vote_totals');if(error){$('#admin-results').textContent=errText(error);return;}counts=rows||[];}
 $('#admin-results').innerHTML=data.categories.length?data.categories.map(c=>{const ns=selectNominees(c.id);const revealed=data.winners.find(w=>w.category_id===c.id);return `<div class="admin-list-item"><strong>${esc(c.emoji||'🏆')} ${esc(c.title)} <small>(${esc(c.edition)})</small></strong><small>${c.voting_open?'Votação aberta':'Votação encerrada'} · ${revealed?'Vencedor revelado':'Ainda não revelado'}</small>${ns.map(n=>`<div class="result-nominee"><span>${esc(n.name)}</span><strong>${counts.find(v=>v.nominee_id===n.id)?.total??0} voto(s)</strong></div>`).join('')||'<p class="dimmed">Sem indicados</p>'}<div class="admin-item-actions">${revealed?'<button data-unreveal="'+esc(c.id)+'">Ocultar vencedor</button>':ns.length?'<button data-reveal="'+esc(c.id)+'">Revelar vencedor</button>':''}</div></div>`;}).join(''):'<p class="dimmed">Nenhuma categoria.</p>';
}
async function reveal(categoryId){const c=data.categories.find(x=>x.id===categoryId);if(!c)return;if(c.voting_open){notify('Encerre a votação da categoria antes de revelar o vencedor.');return;}const ns=selectNominees(categoryId);if(!ns.length)return;let counts=[];if(demo){counts=ns.map(n=>({nominee_id:n.id,total:data.ballots.filter(b=>b.nominee_id===n.id).length}));}else{const{data:rows,error}=await client.rpc('admin_vote_totals');if(error){notify(errText(error));return;}counts=rows.filter(x=>x.category_id===categoryId);}const max=Math.max(0,...counts.map(x=>Number(x.total)));if(max===0){notify('Ainda não há votos nesta categoria.');return;}const leaders=ns.filter(n=>Number(counts.find(v=>v.nominee_id===n.id)?.total||0)===max);let winner=leaders[0];if(leaders.length>1){const choice=prompt(`Empate com ${max} voto(s)! Escolha o número do vencedor:\n${leaders.map((n,i)=>`${i+1}. ${n.name}`).join('\n')}`);winner=leaders[Number(choice)-1];if(!winner){notify('Escolha inválida.');return;}}if(!confirm(`Revelar ${winner.name} como vencedor de "${c.title}"?`))return;try{if(demo){data.winners.push({category_id:categoryId,nominee_id:winner.id});saveDemo();}else{const{error}=await client.from('winners').insert({category_id:categoryId,nominee_id:winner.id});if(error)throw error;}await refreshData();await refreshAdmin();notify(`🏆 ${winner.name} é o vencedor!`);}catch(e){notify(errText(e));}}
async function unreveal(categoryId){if(!confirm('Ocultar este vencedor do Hall da Fama?'))return;try{if(demo){data.winners=data.winners.filter(w=>w.category_id!==categoryId);saveDemo();}else{const{error}=await client.from('winners').delete().eq('category_id',categoryId);if(error)throw error;}await refreshData();await refreshAdmin();notify('Vencedor ocultado.');}catch(e){notify(errText(e));}}
function bindEvents(){document.addEventListener('click',async event=>{const t=event.target.closest('button');if(!t)return;
 if(t.dataset.close){hideDialog(t.dataset.close);return;}
 if(t.dataset.voteCategory){openVote(t.dataset.voteCategory);return;}
 if(t.dataset.adminTab){document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b===t));document.querySelectorAll('.admin-section').forEach(s=>s.hidden=s.id!==`admin-${t.dataset.adminTab}`);if(t.dataset.adminTab==='reveal')await renderResults();return;}
 if(!admin)return;
 if(t.dataset.editCat){editCategory(t.dataset.editCat);return;}
 if(t.dataset.addNominee){openNomineesManager(t.dataset.addNominee);return;}
 if(t.dataset.listNominees){openNomineesManager(t.dataset.listNominees);return;}
 if(t.dataset.removeNominee){await removeNominee(t.dataset.removeNominee);return;}
 if(t.dataset.deleteCat){await deleteCategory(t.dataset.deleteCat);return;}
 if(t.dataset.reveal){await reveal(t.dataset.reveal);return;}
 if(t.dataset.unreveal){await unreveal(t.dataset.unreveal);return;}
 });
 $('#admin-link').addEventListener('click',async()=>{$('#admin-feedback').textContent='';await checkAdmin();if(admin)await refreshAdmin();showDialog('admin-dialog');});
 $('#vote-form').addEventListener('submit',submitVote);
 $('#category-form').addEventListener('submit',saveCategory);
 $('#nominee-form').addEventListener('submit',saveNominee);
 $('#cancel-edit').addEventListener('click',resetCategory);
 $('#codes-form').addEventListener('submit',generateCodes);
 $('#copy-codes').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(recentCodes.join('\n'));notify('Códigos copiados!');}catch{notify('Não foi possível copiar automaticamente. Selecione os códigos na tela.');}});
 $('#demo-admin-btn').addEventListener('click',async()=>{data.adminEnabled=true;saveDemo();admin=true;adminVisibility();await refreshAdmin();notify('Painel de demonstração ativado!');});
 $('#login-form').addEventListener('submit',async e=>{e.preventDefault();$('#admin-feedback').textContent='';try{const{error}=await client.auth.signInWithPassword({email:$('#admin-email').value,password:$('#admin-password').value});if(error)throw error;await checkAdmin();if(!admin)throw Error('Esta conta não está cadastrada como administradora na tabela admins.');await refreshAdmin();notify('Bem-vindo ao painel!');}catch(err){$('#admin-feedback').textContent=errText(err);}});
 $('#logout-btn').addEventListener('click',async()=>{if(demo){data.adminEnabled=false;saveDemo();}else await client.auth.signOut();admin=false;adminVisibility();notify('Sessão encerrada.');});
 ['vote-dialog','admin-dialog','nominees-dialog'].forEach(id=>{const d=document.getElementById(id);d.addEventListener('click',e=>{if(e.target===d)d.close();});});
}
async function start(){bindEvents();showDemoBanner();resetCategory();if(demo){loadDemo();await checkAdmin();renderPublic();}else{try{const{createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');client=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);await checkAdmin();await refreshData();}catch(e){console.error(e);$('#category-grid').innerHTML=`<div class="empty">Não foi possível conectar ao Supabase. Confira config.js e sua conexão. ${esc(errText(e))}</div>`;notify('Erro de conexão com o banco de dados.');}}}
start();
