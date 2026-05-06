## Modal de compartilhamento de localização ao "Iniciar uso"

Adicionar um modal que aparece **antes** de executar `iniciarUso()` em `src/pages/Agendamentos.tsx`, sem alterar o fluxo existente.

### O que será feito

1. **Instalar dependência**: `qrcode.react`.

2. **Novo componente** `src/components/TrackingQrDialog.tsx`:
   - Baseado em `Dialog` (`src/components/ui/dialog.tsx`).
   - Título: "Compartilhar localização?"
   - QR code (`QRCodeSVG` de `qrcode.react`) apontando para:
     `https://[URL-DO-SISTEMA-RASTREAMENTO]/track/{veiculoId}`
     - Como ainda não temos a URL real do projeto de rastreamento, vou deixar uma constante `TRACKING_BASE_URL` no topo do arquivo com um placeholder claramente marcado (`https://rastreamento.lovable.app` como exemplo) para você substituir depois. Posso já trocar pela URL correta se você me passar.
   - Texto: "Escaneie e inicie sua rota"
   - Dois botões:
     - **Recusar** (variant `ghost`) → fecha modal + chama callback `onContinue()`.
     - **Já escaneei** (variant `brand`) → fecha modal + chama callback `onContinue()`.
   - Estilo dark/amarelo já herda do tema atual.

3. **Integração em `Agendamentos.tsx`**:
   - Estado novo: `trackingFor: Agendamento | null`.
   - O botão "Iniciar uso" (linha ~590) passa a chamar `setTrackingFor(a)` em vez de `iniciarUso(a)` direto.
   - Renderizar `<TrackingQrDialog>` recebendo `trackingFor` e, no `onContinue`, executar a `iniciarUso(trackingFor)` original e limpar o estado.
   - **Nada mais é alterado** no fluxo de `iniciarUso`.

### Observação sobre a página `/track/:veiculoId`

Essa tela vive em **outro projeto Lovable** (sistema de rastreamento), portanto não posso editá-la a partir deste projeto — ela precisa ser implementada lá separadamente. Aqui só geramos o QR que aponta para essa URL.

### Arquivos

- novo: `src/components/TrackingQrDialog.tsx`
- editado: `src/pages/Agendamentos.tsx`
- editado: `package.json` (via `bun add qrcode.react`)
