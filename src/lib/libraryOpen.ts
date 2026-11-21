import { clearOpenDocsFolderId } from './docsFolder'

// Continuação de leitura: id do livro aberto no Reader. Gravado ao abrir um
// livro e limpo no "Back to Library" — entrar no modo Library retoma o último
// livro direto na última página, mesmo após fechar/reabrir o app.
export const OPEN_BOOK_KEY = 'monet:reader-open-book'

// Pede à Library que abra o livro na próxima vez que ela montar (o "Open in
// Library" das notas Paper). Um leitor por vez, como o `openReader` da Library:
// a retomada da pasta de documentação é limpa.
export function requestOpenBook(bookId: string): void {
  clearOpenDocsFolderId()
  localStorage.setItem(OPEN_BOOK_KEY, bookId)
}
