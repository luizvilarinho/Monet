# Protocolo para geração do Build e geração de arquivos .msi e msig
## Passo 1
 - incrementar versão no arquivo src\components\NotebookList\NotebookList.tsx
 - atualizar linha abaixo com o valor incremental. Esse valor fica visível ao usuário
 <span className={styles.version}>vx.x.xx</span>

 ## passo 2
 - usar o mesmo valor para atualizar o arquivo src-tauri\tauri.conf.json - "version"

 ## passo 3
 - gerar o build com o comando npm run tauri:build
 - aguardar o build terminar

 ## passo 4
 - encontrar o arquivo .sig gerado no build - fica dentro dessa pasta src-tauri\target\release\bundle\msi e copiar a chave

## passo 5
 - atualizar o arquivo latest.json
 - atualizar "notes", "url" e "signature" com os novos dados.