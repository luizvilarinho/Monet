# Review Report — print de tela no Assistant

- Execution report: `DOCS/reports/18-10-2026/executionreport_20261018000019.md` (decisão do Orquestrador 20261018183000 + CodeAgent 20261018143844)
- Escopo: `src-tauri/src/screenshot.rs` (novo, lido inteiro); `src-tauri/Cargo.toml` (features da `windows`); `src-tauri/src/lib.rs` (`mod screenshot` e registro do comando); `src/components/ChatPanel/ChatComposer.tsx` e `.module.css` (prop `onCaptureScreen`, botão, `isCapturing`); `src/components/AssistantPanel/AssistantPanel.tsx` (ligação do botão).
- Fora do escopo: o resto do `ChatComposer` (extração do composer, outra parte da task, já revisada).

## Verificação
- `cargo check --examples`: ok, sem warnings.
- `cargo test --lib`: 29 ok, 0 falhas, 3 ignorados (`ocr_reads_generated_image` + os 2 novos de `screenshot`).
- `npx tsc --noEmit`: ok.
- App não aberto; código não alterado.

## Veredicto
Veredicto: **APROVADO COM RESSALVAS**
A captura está correta e sem vazamento de GDI. Há duas ressalvas: o fallback não cobre o Windows antigo que ele diz cobrir (no Windows 10 1809 LTSC, aceito pelo MSIX, o print sai com um retângulo preto no lugar do Assistant), e o aviso de erro da captura fica preso na tela.

---

## [importante]

### 1. O fallback hide/show nunca roda no Windows antigo: o print sai com um retângulo preto
`src-tauri/src/screenshot.rs:136-137` (comentário), `:154`
- O código parte da premissa de que `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` **falha** antes do Windows 10 2004. A documentação da Microsoft diz o contrário: *"Setting the display affinity to WDA_EXCLUDEFROMCAPTURE on previous version of Windows will behave as if WDA_MONITOR is applied."* A chamada **funciona** e aplica `WDA_MONITOR`: a janela aparece no print **sem conteúdo** (preta).
- Consequência: em builds < 19041, `set_display_affinity` devolve `true` e o fallback não roda. O print sai com um retângulo preto onde está o Assistant.
- O caso existe: o MSIX declara `MinVersion="10.0.17763.0"` (`src-tauri/target/msix/stage/AppxManifest.xml:21`). O build 17763 é o Windows 10 1809, que inclui o Enterprise LTSC 2019, ainda com suporte.
- Na prática, o fallback hoje só roda quando o `hwnd()` ou o `run_on_main_thread` falham. Os dois são improváveis.
- Sugestão, uma das duas:
  - (a) decidir pelo build do SO: `RtlGetVersion` (ntdll) ou `AnalyticsInfo.VersionInfo.DeviceFamilyVersion` (WinRT, já no padrão do projeto). Com build ≥ 19041, usar a exclusão; abaixo disso, hide/show. Corrigir o comentário das linhas 136-137;
  - (b) subir o `MinVersion` do MSIX para `10.0.19041.0` e **remover** o fallback e `HIDE_SETTLE` (simplifica). Decisão de produto do Coordenador: deixa de fora o 1809/1909, incluindo o LTSC 2019.

### 2. O aviso de erro da captura fica preso na tela
`src/components/ChatPanel/ChatComposer.tsx:74-78`, `:289-300`, `:205`
- `imageError` só é limpo no início de outra captura (`:105`) ou ao escolher arquivo (`:133`). Até esta feature ele nunca era preenchido, então o problema é novo.
- Depois de uma captura com erro, o aviso continua visível:
  - ao trocar de conversa: o efeito de `resetKey` limpa draft, imagem e docs, mas não `imageError`;
  - ao colar uma imagem válida (`onPaste`);
  - ao remover a imagem ou enviar a mensagem.
- Resultado: um "Could not read the screen." fica ao lado de um preview válido, ou em outra conversa.
- Sugestão: `setImageError(null)` no efeito de `resetKey` e no `onPaste`. Para alinhar com o `docError`, limpar também o `docError` no efeito.

---

## [nit]

### 3. `WDA_NONE` volta sem guard e sem checar o resultado
`src-tauri/src/screenshot.rs:154-158`
- A restauração roda em todos os caminhos de `Result`: `capture_rect` não usa `?` entre a exclusão e o restore, e a alocação do `Vec` é feita antes.
- Hoje não há panic realista nesse trecho. Ainda assim:
  - um panic futuro deixaria a janela excluída até a próxima captura;
  - o retorno da restauração é descartado. Se ela falhar, o Assistant some de gravações e compartilhamento de tela sem nenhum log.
- Sugestão: guard RAII (struct com `Drop` que chama `set_display_affinity(window, WDA_NONE)`) e `eprintln!` quando a restauração devolver `false`.

### 4. Captura concorrente: sem trava no backend
`src-tauri/src/screenshot.rs:172-180`
- O frontend protege com `isCapturing` e `disabled` (`ChatComposer.tsx:103`, `:319`). No React 18 o clique é evento discreto, e o duplo clique já encontra o botão desabilitado.
- O comando em si não tem trava. Em duas chamadas sobrepostas, a 1ª devolve `WDA_NONE` enquanto a 2ª ainda espera os 100 ms, e a 2ª sai com o Assistant no print.
- O risco é teórico: há um único chamador.
- Sugestão: `static CAPTURING: AtomicBool` com `compare_exchange`, devolvendo `"A screen capture is already running."`.

### 5. Trocar de conversa durante a captura leva o print para a conversa nova
`src/components/ChatPanel/ChatComposer.tsx:102-114`
- Já registrado pelo codeAgent. A janela é de ~0,1 s com a exclusão.
- O fallback chama `show()`, que não emite `assistant-shown`, então não cria conversa nova (`lib.rs:33-50`).
- Correção barata: guardar `resetKey` num `useRef` no início de `handleCaptureScreen` e descartar o resultado se a conversa mudou.

### 6. `window.hwnd()` é buscado 3 vezes por captura
`src-tauri/src/screenshot.rs:139`, `:152`
- `capture_without_window` já tem o HWND. `set_display_affinity` busca de novo a cada chamada: cada `hwnd()` é uma ida e volta ao event loop.
- Sugestão: passar o HWND como `isize` para `set_display_affinity`. Isso também elimina o `let Ok(hwnd) = ... else { return false }`, que em caso de erro levaria ao fallback.

### 7. `unsafe` sem comentário `SAFETY`
`src-tauri/src/screenshot.rs:45`, `:63`, `:144`
- A convenção do projeto é o `// SAFETY:` (`src-tauri/src/vec_db.rs:22`).
- O bloco maior (`:63-108`) tem comentários pontuais, mas não diz o invariante. Por exemplo: "todo handle criado aqui é liberado antes de sair do bloco; não há `?` nem retorno entre a criação e a liberação".

### 8. Os testes `#[ignore]` não cobrem escala ≠ 100% nem a janela real
`src-tauri/src/screenshot.rs:197-298`
- O `#[ignore]` se justifica: os testes leem a tela real e abrem uma janela.
- O binário de teste não passa pelo tao, então roda **DPI-unaware**. No app, o tao aplica Per-Monitor V2 ao processo inteiro (`tao-0.34.8/src/platform_impl/windows/dpi.rs:26`, chamado em `event_loop.rs:190`). Por isso, os testes só validam o caminho físico a 100%.
- Escala ≠ 100%, multimonitor, `run_on_main_thread`, WebView2 e o fallback dependem do teste manual no app.
- `assert!(elapsed < EXCLUDE_SETTLE)` (`:296`) mede também o tempo da própria captura e pode falhar numa máquina carregada. Como o teste é manual, é aceitável.

### 9. Monitor com HDR
`src-tauri/src/screenshot.rs:73`
- Com HDR ligado, a captura GDI sai com cores lavadas ou estouradas. É limitação da técnica, sem ação agora.
- Vale registrar no "Left behind", junto com o cursor fora do print.

---

## Pontos verificados sem problema
- **Recursos GDI:**
  - `GetDC`/`ReleaseDC`, `CreateCompatibleDC`/`DeleteDC` e `CreateCompatibleBitmap`/`DeleteObject` são liberados em todos os caminhos. Não há `?` nem `return` entre a criação e a liberação, e o único early return (`:66`) vem antes de qualquer alocação;
  - quando `CreateCompatibleDC` ou `CreateCompatibleBitmap` falham, as chamadas seguintes falham sem efeito e o `lines != height` vira erro.
- **`GetDIBits`:** o bitmap é desselecionado antes da chamada (exigência da API). Com 32 bpp e `BI_RGB`, o stride é `width*4`, sem padding, e o buffer tem o tamanho exato. `biHeight` negativo deixa as linhas de cima para baixo.
- **BGRA:** a ordem do GDI (B, G, R, X, com o byte X indefinido) bate com `BitmapPixelFormat::Bgra8` + `BitmapAlphaMode::Ignore`.
- **`StretchBlt`:** `HALFTONE` + `SetBrushOrgEx(0,0)` é o par correto. O bitmap é compatível com o DC da tela, não com o DC de memória (que seria monocromático).
- **Multimonitor:** coordenadas negativas do `rcMonitor` funcionam no DC de `GetDC(NULL)`, que cobre o desktop virtual. Os pixels são físicos no app, porque a DPI awareness é do processo e vale também para a thread do `spawn_blocking`.
- **`run_on_main_thread`:** não há deadlock, porque a main thread não espera o comando. Se o closure for descartado sem rodar, o `tx` cai, o `recv` dá erro e a função devolve `false`. A espera de 100 ms começa depois que a afinidade já foi aplicada.
- **Fallback:** sempre chama `show()` e `set_focus()`, mesmo com erro na captura (o `?` vem depois do bloco). O monitor é lido antes do `hide()`.
- **Frontend:**
  - o erro do comando chega como string, então `typeof err === 'string'` funciona;
  - o resultado vai para o mesmo `draftImage` do paste (preview, remover, aviso de modelo sem visão), sem duplicar lógica;
  - o Chat principal não recebe a prop, então o botão não aparece lá;
  - o CSS usa tokens e reaproveita `pdfPulse`.
- **Dependências:** só features novas na `windows` 0.61, que já era usada. Nenhuma crate nova. O comando foi registrado em `lib.rs:1721`.

## Bugs extras
Nenhum no código lido.
