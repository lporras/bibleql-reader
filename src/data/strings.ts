import type { ChatgptErrorCode } from "../types/ai";

export type Locale = "en" | "es";

export interface StringsShape {
  refPlaceholder: string;
  compare: string;
  panel: string;
  theme: string;
  aiApiKey: string;
  aiSettings: string;
  aiSetupTitle: string;
  aiSetupHelp: string;
  aiSetupKey: string;
  aiProvider: string;
  aiModel: string;
  aiClaudeNeedsKey: string;
  aiChooseModel: string;
  aiChooseFirst: string;
  aiModelsLoading: string;
  aiModelsError: string;
  aiModelsEmpty: string;
  aiModelGone: string;
  aiModelsRefresh: string;
  aiModelsRefreshing: string;
  aiModelsRefreshed: string;
  chatgptUsingPlan: string;
  chatgptFailure: {
    limit: string;
    unavailable: string;
    notEligible: string;
    modelUnavailable: string;
    unsupported: string;
    credential: string;
    restricted: string;
    incomplete: string;
    interrupted: string;
    badFormat: string;
    generic: string;
  };
  chatgptPlanTitle: string;
  chatgptPlanHelp: string;
  chatgptPlanNote: string;
  chatgptPlanDisabled: string;
  chatgptContinue: string;
  chatgptDifferentAccount: string;
  chatgptWaiting: string;
  chatgptSignedInAs: string;
  chatgptSignedIn: string;
  chatgptSignOut: string;
  chatgptReconnect: string;
  chatgptManageUsage: string;
  chatgptRevokeUnconfirmed: string;
  chatgptWelcomeTitle: string;
  chatgptWelcomeBody: string;
  chatgptGotIt: string;
  chatgptError: Record<ChatgptErrorCode, string>;
  translation: string;
  findBook: string;
  prev: string;
  next: string;
  assistant: string;
  concordance: string;
  search: string;
  aiIntro: string;
  aiPlaceholder: string;
  ask: string;
  thinking: string;
  concPlaceholder: string;
  look: string;
  more: string;
  searchPlaceholder: string;
  go: string;
  aiKeyHelp: string;
  cancel: string;
  save: string;
  noKey: string;
  connected: string;
  connecting: string;
  notConnected: string;
  loading: string;
  concIdle: string;
  searchIdle: string;
  occ: string;
  versesN: string;
  old: string;
  nw: string;
  sample: string;
  s1: string;
  s2: string;
  s3: string;
  oldTestament: string;
  newTestament: string;
  pickTranslation: string;
  concUnsupported: string;
  listen: string;
  stop: string;
  listenVerse: string;
  selectedCount: string;
  createImage: string;
  clearSelection: string;
  addScripture: string;
  changeSelection: string;
  creatorBack: string;
  creatorTitle: string;
  background: string;
  chooseImage: string;
  changeImage: string;
  noBackground: string;
  scripture: string;
  properties: string;
  noElementSelected: string;
  font: string;
  fontSize: string;
  color: string;
  align: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  overlay: string;
  preset: string;
  zoom: string;
  positionX: string;
  positionY: string;
  uploadFromDisk: string;
  photoBy: string;
  useAsBackground: string;
  saveImage: string;
  copyImage: string;
  saving: string;
  saved: string;
  copied: string;
  saveError: string;
  copyError: string;
  format: string;
  editTextHint: string;
  searchTab: string;
  curatedTab: string;
  diskTab: string;
  searchUnsplash: string;
  searchEmpty: string;
  searchError: string;
  unsplashOffline: string;
  imagesRateLimited: string;
  imagesUnavailable: string;
  updateGet: string;
  marks: string;
  addNote: string;
  editNote: string;
  favorite: string;
  unfavorite: string;
  highlight: string;
  highlightColor: string;
  removeHighlight: string;
  moreActions: string;
  copyVerse: string;
  clearMarks: string;
  note: string;
  notePlaceholder: string;
  deleteNote: string;
  close: string;
  marksIdle: string;
  allMarks: string;
  favorites: string;
  highlights: string;
  notes: string;
  noMarks: string;
  selectedVerses: string;
  offlineDownload: string;
  offlineDownloading: string;
  offlineInstalling: string;
  offlineCancel: string;
  offlineAvailable: string;
  offlineUpdate: string;
  offlineUpdateAction: string;
  offlineRemove: string;
  offlineRemoving: string;
  offlineChecksum: string;
  offlineRetry: string;
  offlineBadge: string;
  offlineVerses: string;
  studyTab: string;
  studies: string;
  addToStudy: string;
  inStudy: string;
  addRefToStudy: string;
  refInStudy: string;
  openInReader: string;
  untitledStudy: string;
  studyIdle: string;
  newStudy: string;
  openStudy: string;
  currentStudy: string;
  noPassages: string;
  passagesN: string;
  removePassage: string;
  studyTitlePlaceholder: string;
  studyBodyPlaceholder: string;
  passages: string;
  insertIntoNotes: string;
  moveUp: string;
  moveDown: string;
  exportPdf: string;
  exporting: string;
  exported: string;
  exportError: string;
  deleteStudy: string;
  confirmDelete: string;
  backToReader: string;
  editedAt: string;
  studyNotFound: string;
  textPending: string;
  fromAssistant: string;
  fmtBold: string;
  fmtItalic: string;
  fmtHeading: string;
  fmtSubheading: string;
  fmtBullets: string;
  fmtNumbers: string;
  fmtQuote: string;
  fmtAlignLeft: string;
  fmtAlignCenter: string;
  fmtAlignRight: string;
  fmtJustify: string;
  fmtRule: string;
  fmtLink: string;
  fmtImage: string;
  fmtVideo: string;
  watchOnYoutube: string;
  linkUrl: string;
  videoUrl: string;
  applyUrl: string;
  removeLink: string;
  invalidVideo: string;
  imageError: string;
  ss1: string;
  ss2: string;
  ss3: string;
}

export const STR: Record<Locale, StringsShape> = {
  en: {
    refPlaceholder: "Go to reference — John 3:16",
    compare: "Compare",
    panel: "Tools",
    theme: "Theme",
    aiApiKey: "Anthropic API key",
    aiSettings: "AI settings",
    aiSetupTitle: "Set up the assistant",
    aiSetupHelp: "The assistant needs an AI account to answer your questions. Connect one to get started.",
    aiSetupKey: "Use an Anthropic API key",
    aiProvider: "Answers from",
    aiModel: "Model",
    aiClaudeNeedsKey: "Claude (add a key)",
    aiChooseModel: "Choose a model",
    aiChooseFirst: "Choose who answers before asking.",
    aiModelsLoading: "Loading your models…",
    aiModelsError: "Couldn't load your ChatGPT models. Check your connection and refresh them in AI settings.",
    aiModelsEmpty: "Your ChatGPT account has no models available for this app.",
    aiModelGone: "The model you were using is no longer available. Choose another to keep asking.",
    aiModelsRefresh: "Refresh models",
    aiModelsRefreshing: "Refreshing…",
    aiModelsRefreshed: "Models up to date",
    chatgptUsingPlan: "Using ChatGPT plan",
    chatgptFailure: {
      limit: "You've reached your ChatGPT plan's limit for this app. See \"Manage usage\" in AI settings, or switch to Claude.",
      unavailable: "ChatGPT plan usage is temporarily unavailable. Please try again in a moment.",
      notEligible: "This ChatGPT account can't use its plan in this app. It needs a Plus or Pro plan.",
      modelUnavailable: "That model isn't available for this app. Choose another one above.",
      unsupported: "ChatGPT can't do this with your plan:",
      credential: "ChatGPT didn't accept your account for this request.",
      restricted: "ChatGPT blocked this request for your account or region.",
      incomplete: "ChatGPT stopped before finishing that answer. Please try again.",
      interrupted: "The connection dropped before the answer finished. Please try again.",
      badFormat: "The assistant's reply didn't match the expected format. Try rephrasing.",
      generic: "ChatGPT couldn't answer that. Please try again."
    },
    chatgptPlanTitle: "Use your ChatGPT plan",
    chatgptPlanHelp:
      "Sign in so the assistant can answer using your ChatGPT account. You need a Plus or Pro plan. This app doesn't charge you anything.",
    chatgptPlanNote: "The assistant answers using your ChatGPT plan. You can see how much you've used in your ChatGPT settings.",
    chatgptPlanDisabled:
      "You signed in, but didn't allow this app to use your ChatGPT plan, so it can't answer with it. Reconnect to allow it, or use an API key.",
    chatgptContinue: "Continue with ChatGPT",
    chatgptDifferentAccount: "Use a different account",
    chatgptWaiting: "Finish signing in in your browser…",
    chatgptSignedInAs: "Signed in as",
    chatgptSignedIn: "Signed in to ChatGPT",
    chatgptSignOut: "Sign out",
    chatgptReconnect: "Reconnect",
    chatgptManageUsage: "Manage usage",
    chatgptRevokeUnconfirmed:
      "You're signed out here, but OpenAI couldn't confirm access was revoked. To be sure, disconnect this app in your ChatGPT settings.",
    chatgptWelcomeTitle: "You're using your ChatGPT plan",
    chatgptWelcomeBody: "The assistant will answer using your ChatGPT plan.",
    chatgptGotIt: "Got it",
    chatgptError: {
      access_denied: "Sign-in was cancelled in the browser.",
      account_mismatch:
        "That's a different account from the one last used here. To switch, choose \"Use a different account\".",
      browser: "Couldn't open your browser to sign in.",
      cancelled: "Sign-in was cancelled.",
      invalid_client: "OpenAI rejected this app's registration. Try \"Use a different account\".",
      invalid_grant: "That sign-in expired before it could finish. Please try again.",
      invalid_id_token: "OpenAI's sign-in response couldn't be verified. Please try again.",
      models_failed: "Couldn't load your ChatGPT models.",
      plan_disabled: "You haven't allowed this app to use your ChatGPT plan. Reconnect in AI settings.",
      network: "Couldn't reach OpenAI. Check your connection and try again.",
      oauth_error: "Sign-in with ChatGPT failed. Please try again.",
      random: "Sign-in with ChatGPT failed. Please try again.",
      reauth_required: "Your ChatGPT sign-in has ended. Please sign in again.",
      refresh_failed: "Couldn't renew your ChatGPT sign-in. Please try again.",
      registration_incomplete: "OpenAI didn't finish registering this app. Please try again.",
      sign_out_first: "Sign out before using a different account.",
      storage: "Couldn't access this device's secure storage for your ChatGPT sign-in.",
      timeout: "Sign-in timed out. Please try again."
    },
    translation: "Translation",
    findBook: "Filter books",
    prev: "Previous chapter",
    next: "Next chapter",
    assistant: "Assistant",
    concordance: "Concordance",
    search: "Search",
    aiIntro: "Ask a question about Scripture and get an answer with references you can open.",
    aiPlaceholder: "What does the Bible say about forgiving someone repeatedly?",
    ask: "Ask",
    thinking: "Thinking…",
    concPlaceholder: "Word to study",
    look: "Look up",
    more: "Load more",
    searchPlaceholder: "Words or phrase",
    go: "Search",
    aiKeyHelp: "Used only for the Assistant tab. Sent straight to Anthropic from this machine, never stored elsewhere.",
    cancel: "Cancel",
    save: "Save",
    noKey: "Couldn't connect to BibleQL — showing a bundled sample chapter. Retrying in the background.",
    connected: "Connected",
    connecting: "Connecting…",
    notConnected: "Not connected",
    loading: "Loading…",
    concIdle: "Every occurrence of a word, in canonical order, with context.",
    searchIdle: "Substring search across the current translation.",
    occ: "occurrences",
    versesN: "verses",
    old: "OT",
    nw: "NT",
    sample: "Sample text — World English Bible, public domain",
    s1: "Where does the Bible talk about rest?",
    s2: "Verses on hospitality to strangers",
    s3: "What is the difference between grace and mercy?",
    oldTestament: "Old Testament",
    newTestament: "New Testament",
    pickTranslation: "Type to filter translations",
    concUnsupported: "BibleQL has no concordance index for %s. Indexed: %l.",
    listen: "Listen to chapter",
    stop: "Stop",
    listenVerse: "Listen to verse",
    selectedCount: "%n selected",
    createImage: "Create Image",
    clearSelection: "Clear",
    addScripture: "Add Scripture",
    changeSelection: "Change Selection",
    creatorBack: "Back to Reader",
    creatorTitle: "Image Creator",
    background: "Background",
    chooseImage: "Choose Image",
    changeImage: "Change Image",
    noBackground: "No background yet",
    scripture: "Scripture",
    properties: "Properties",
    noElementSelected: "Select an element to edit its properties",
    font: "Font",
    fontSize: "Size",
    color: "Color",
    align: "Alignment",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    overlay: "Overlay",
    preset: "Preset",
    zoom: "Zoom",
    positionX: "Horizontal position",
    positionY: "Vertical position",
    uploadFromDisk: "Upload from Disk",
    photoBy: "Photo by %s on %l",
    useAsBackground: "Use as background",
    saveImage: "Save Image",
    copyImage: "Copy Image",
    saving: "Saving…",
    saved: "Saved",
    copied: "Copied",
    saveError: "Couldn't save the image.",
    copyError: "Couldn't copy the image.",
    format: "Format",
    editTextHint: "Double-click the text on the canvas to edit or shorten it.",
    searchTab: "Search",
    curatedTab: "Curated",
    diskTab: "Disk",
    searchUnsplash: "Search Unsplash — mountains, sunrise, ocean…",
    searchEmpty: "No photos found.",
    searchError: "Unable to load images from Unsplash. Check your internet connection and try again.",
    unsplashOffline: "Unsplash is unavailable offline. You can use a local image instead.",
    imagesRateLimited: "Too many image searches right now. Try again in a few minutes.",
    imagesUnavailable: "Image search is unavailable right now. Try again later, or use a local image.",
    updateGet: "Get the update",
    marks: "Marks",
    addNote: "Add note",
    editNote: "Edit note",
    favorite: "Favorite",
    unfavorite: "Remove favorite",
    highlight: "Highlight",
    highlightColor: "Highlight color",
    removeHighlight: "Remove highlight",
    moreActions: "More",
    copyVerse: "Copy text",
    clearMarks: "Clear marks",
    note: "Note",
    notePlaceholder: "What this passage says to you…",
    deleteNote: "Delete note",
    close: "Close",
    marksIdle: "Select a verse in the reader to favorite, highlight or annotate it.",
    allMarks: "All",
    favorites: "Favorites",
    highlights: "Highlights",
    notes: "Notes",
    noMarks: "Nothing marked yet.",
    selectedVerses: "selected",
    offlineDownload: "Download for offline · %s",
    offlineDownloading: "Downloading… %p",
    offlineInstalling: "Installing…",
    offlineCancel: "Cancel download",
    offlineAvailable: "Available offline",
    offlineUpdate: "Update available",
    offlineUpdateAction: "Update · %s",
    offlineRemove: "Remove download",
    offlineRemoving: "Removing…",
    offlineChecksum: "The download was damaged (checksum mismatch). Try again.",
    offlineRetry: "Retry",
    offlineBadge: "offline",
    offlineVerses: "%n verses on this device",
    studyTab: "Sermon",
    studies: "Sermons",
    addToStudy: "Add to study",
    inStudy: "In study",
    addRefToStudy: "Add to the current study",
    refInStudy: "Already in the current study",
    openInReader: "Open in the reader",
    untitledStudy: "Untitled study",
    studyIdle: "Gather passages for a sermon or a lesson: select verses in the reader, or ask the assistant, and add them to a study.",
    newStudy: "New study",
    openStudy: "Open study",
    currentStudy: "Current study",
    noPassages: "No passages yet.",
    passagesN: "%n passages",
    removePassage: "Remove from study",
    studyTitlePlaceholder: "Sermon or study title",
    studyBodyPlaceholder: "Write your outline, notes and application…",
    passages: "Passages",
    insertIntoNotes: "Insert into notes",
    moveUp: "Move up",
    moveDown: "Move down",
    exportPdf: "Export PDF",
    exporting: "Exporting…",
    exported: "PDF saved",
    exportError: "Couldn't save the PDF.",
    deleteStudy: "Delete study",
    confirmDelete: "Delete for good?",
    backToReader: "Reader",
    editedAt: "Edited %s",
    studyNotFound: "This study no longer exists.",
    textPending: "Loading text…",
    fromAssistant: "Suggested by the assistant",
    fmtBold: "Bold",
    fmtItalic: "Italic",
    fmtHeading: "Heading",
    fmtSubheading: "Subheading",
    fmtBullets: "Bulleted list",
    fmtNumbers: "Numbered list",
    fmtQuote: "Quote",
    fmtAlignLeft: "Align left",
    fmtAlignCenter: "Center",
    fmtAlignRight: "Align right",
    fmtJustify: "Justify",
    fmtRule: "Divider",
    fmtLink: "Link",
    fmtImage: "Insert image",
    fmtVideo: "Insert YouTube video",
    watchOnYoutube: "Watch on YouTube",
    linkUrl: "Link address",
    videoUrl: "YouTube link",
    applyUrl: "Apply",
    removeLink: "Remove link",
    invalidVideo: "That isn't a YouTube link.",
    imageError: "That image couldn't be added.",
    ss1: "Suggest key verses for this study",
    ss2: "Outline a three-point sermon on this theme",
    ss3: "Which cross-references support this theme?"
  },
  es: {
    refPlaceholder: "Ir a la referencia — Juan 3:16",
    compare: "Comparar",
    panel: "Herramientas",
    theme: "Tema",
    aiApiKey: "Clave de API de Anthropic",
    aiSettings: "Ajustes de IA",
    aiSetupTitle: "Configura el asistente",
    aiSetupHelp: "El asistente necesita una cuenta de IA para responder tus preguntas. Conecta una para empezar.",
    aiSetupKey: "Usar una clave de API de Anthropic",
    aiProvider: "Responde",
    aiModel: "Modelo",
    aiClaudeNeedsKey: "Claude (agrega una clave)",
    aiChooseModel: "Elige un modelo",
    aiChooseFirst: "Elige quién responde antes de preguntar.",
    aiModelsLoading: "Cargando tus modelos…",
    aiModelsError: "No se pudieron cargar tus modelos de ChatGPT. Revisa tu conexión y actualízalos en Ajustes de IA.",
    aiModelsEmpty: "Tu cuenta de ChatGPT no tiene modelos disponibles para esta aplicación.",
    aiModelGone: "El modelo que usabas ya no está disponible. Elige otro para seguir preguntando.",
    aiModelsRefresh: "Actualizar modelos",
    aiModelsRefreshing: "Actualizando…",
    aiModelsRefreshed: "Modelos al día",
    chatgptUsingPlan: "Usando tu plan de ChatGPT",
    chatgptFailure: {
      limit: "Llegaste al límite de tu plan de ChatGPT para esta aplicación. Mira \"Administrar uso\" en Ajustes de IA o cambia a Claude.",
      unavailable: "El uso de tu plan de ChatGPT no está disponible por ahora. Inténtalo de nuevo en un momento.",
      notEligible: "Esta cuenta de ChatGPT no puede usar su plan en esta aplicación. Necesita un plan Plus o Pro.",
      modelUnavailable: "Ese modelo no está disponible para esta aplicación. Elige otro arriba.",
      unsupported: "ChatGPT no puede hacer esto con tu plan:",
      credential: "ChatGPT no aceptó tu cuenta para esta solicitud.",
      restricted: "ChatGPT bloqueó esta solicitud para tu cuenta o región.",
      incomplete: "ChatGPT se detuvo antes de terminar la respuesta. Inténtalo de nuevo.",
      interrupted: "La conexión se cortó antes de terminar la respuesta. Inténtalo de nuevo.",
      badFormat: "La respuesta del asistente no tuvo el formato esperado. Intenta reformular la pregunta.",
      generic: "ChatGPT no pudo responder. Inténtalo de nuevo."
    },
    chatgptPlanTitle: "Usa tu plan de ChatGPT",
    chatgptPlanHelp:
      "Inicia sesión para que el asistente responda con tu cuenta de ChatGPT. Necesitas un plan Plus o Pro. Esta aplicación no te cobra nada.",
    chatgptPlanNote: "El asistente responde con tu plan de ChatGPT. Puedes ver cuánto usas en los ajustes de ChatGPT.",
    chatgptPlanDisabled:
      "Iniciaste sesión, pero no permitiste que esta aplicación use tu plan de ChatGPT, así que no puede responder con él. Vuelve a conectar para permitirlo o usa una clave de API.",
    chatgptContinue: "Continuar con ChatGPT",
    chatgptDifferentAccount: "Usar otra cuenta",
    chatgptWaiting: "Termina de iniciar sesión en tu navegador…",
    chatgptSignedInAs: "Sesión iniciada como",
    chatgptSignedIn: "Sesión iniciada en ChatGPT",
    chatgptSignOut: "Cerrar sesión",
    chatgptReconnect: "Volver a conectar",
    chatgptManageUsage: "Administrar uso",
    chatgptRevokeUnconfirmed:
      "Cerraste sesión aquí, pero OpenAI no pudo confirmar que se revocó el acceso. Para asegurarte, desconecta esta aplicación en los ajustes de ChatGPT.",
    chatgptWelcomeTitle: "Estás usando tu plan de ChatGPT",
    chatgptWelcomeBody: "El asistente responderá con tu plan de ChatGPT.",
    chatgptGotIt: "Entendido",
    chatgptError: {
      access_denied: "Se canceló el inicio de sesión en el navegador.",
      account_mismatch:
        "Esa cuenta es distinta de la última que se usó aquí. Para cambiar, elige \"Usar otra cuenta\".",
      browser: "No se pudo abrir el navegador para iniciar sesión.",
      cancelled: "Se canceló el inicio de sesión.",
      invalid_client: "OpenAI rechazó el registro de esta aplicación. Prueba \"Usar otra cuenta\".",
      invalid_grant: "Ese inicio de sesión caducó antes de terminar. Inténtalo de nuevo.",
      invalid_id_token: "No se pudo verificar la respuesta de inicio de sesión de OpenAI. Inténtalo de nuevo.",
      models_failed: "No se pudieron cargar tus modelos de ChatGPT.",
      plan_disabled: "No has permitido que esta aplicación use tu plan de ChatGPT. Vuelve a conectar en Ajustes de IA.",
      network: "No se pudo conectar con OpenAI. Revisa tu conexión e inténtalo de nuevo.",
      oauth_error: "Falló el inicio de sesión con ChatGPT. Inténtalo de nuevo.",
      random: "Falló el inicio de sesión con ChatGPT. Inténtalo de nuevo.",
      reauth_required: "Tu sesión de ChatGPT terminó. Vuelve a iniciar sesión.",
      refresh_failed: "No se pudo renovar tu sesión de ChatGPT. Inténtalo de nuevo.",
      registration_incomplete: "OpenAI no terminó de registrar esta aplicación. Inténtalo de nuevo.",
      sign_out_first: "Cierra sesión antes de usar otra cuenta.",
      storage: "No se pudo acceder al almacenamiento seguro de este dispositivo para tu sesión de ChatGPT.",
      timeout: "Se agotó el tiempo para iniciar sesión. Inténtalo de nuevo."
    },
    translation: "Traducción",
    findBook: "Filtrar libros",
    prev: "Capítulo anterior",
    next: "Capítulo siguiente",
    assistant: "Asistente",
    concordance: "Concordancia",
    search: "Buscar",
    aiIntro: "Haz una pregunta sobre las Escrituras y recibe una respuesta con referencias que puedes abrir.",
    aiPlaceholder: "¿Qué dice la Biblia sobre perdonar muchas veces?",
    ask: "Preguntar",
    thinking: "Pensando…",
    concPlaceholder: "Palabra a estudiar",
    look: "Buscar",
    more: "Cargar más",
    searchPlaceholder: "Palabras o frase",
    go: "Buscar",
    aiKeyHelp: "Se usa solo en la pestaña Asistente. Se envía directo a Anthropic desde este equipo, nunca se guarda en otro lugar.",
    cancel: "Cancelar",
    save: "Guardar",
    noKey: "No se pudo conectar con BibleQL — mostrando un capítulo de muestra. Reintentando en segundo plano.",
    connected: "Conectado",
    connecting: "Conectando…",
    notConnected: "Sin conexión",
    loading: "Cargando…",
    concIdle: "Cada aparición de una palabra, en orden canónico, con su contexto.",
    searchIdle: "Búsqueda de texto en la traducción actual.",
    occ: "apariciones",
    versesN: "versículos",
    old: "AT",
    nw: "NT",
    sample: "Texto de muestra — Reina Valera 1909, dominio público",
    s1: "¿Dónde habla la Biblia del descanso?",
    s2: "Versículos sobre hospitalidad al extranjero",
    s3: "¿Cuál es la diferencia entre gracia y misericordia?",
    oldTestament: "Antiguo Testamento",
    newTestament: "Nuevo Testamento",
    pickTranslation: "Escribe para filtrar traducciones",
    concUnsupported: "BibleQL no tiene índice de concordancia para %s. Con índice: %l.",
    listen: "Escuchar capítulo",
    stop: "Detener",
    listenVerse: "Escuchar versículo",
    selectedCount: "%n seleccionado(s)",
    createImage: "Crear imagen",
    clearSelection: "Borrar",
    addScripture: "Agregar Escritura",
    changeSelection: "Cambiar selección",
    creatorBack: "Volver al lector",
    creatorTitle: "Creador de imágenes",
    background: "Fondo",
    chooseImage: "Elegir imagen",
    changeImage: "Cambiar imagen",
    noBackground: "Todavía no hay fondo",
    scripture: "Escritura",
    properties: "Propiedades",
    noElementSelected: "Selecciona un elemento para editar sus propiedades",
    font: "Fuente",
    fontSize: "Tamaño",
    color: "Color",
    align: "Alineación",
    alignLeft: "Izquierda",
    alignCenter: "Centro",
    alignRight: "Derecha",
    overlay: "Superposición",
    preset: "Formato",
    zoom: "Zoom",
    positionX: "Posición horizontal",
    positionY: "Posición vertical",
    uploadFromDisk: "Subir desde el disco",
    photoBy: "Foto de %s en %l",
    useAsBackground: "Usar como fondo",
    saveImage: "Guardar imagen",
    copyImage: "Copiar imagen",
    saving: "Guardando…",
    saved: "Guardado",
    copied: "Copiado",
    saveError: "No se pudo guardar la imagen.",
    copyError: "No se pudo copiar la imagen.",
    format: "Tipo de archivo",
    editTextHint: "Haz doble clic en el texto del lienzo para editarlo o acortarlo.",
    searchTab: "Buscar",
    curatedTab: "Sugeridas",
    diskTab: "Disco",
    searchUnsplash: "Buscar en Unsplash — montañas, amanecer, océano…",
    searchEmpty: "No se encontraron fotos.",
    searchError: "No se pudieron cargar imágenes de Unsplash. Revisa tu conexión e intenta de nuevo.",
    unsplashOffline: "Unsplash no está disponible sin conexión. Puedes usar una imagen local.",
    imagesRateLimited: "Demasiadas búsquedas de imágenes por ahora. Intenta de nuevo en unos minutos.",
    imagesUnavailable: "La búsqueda de imágenes no está disponible ahora. Intenta más tarde o usa una imagen local.",
    updateGet: "Obtener la actualización",
    marks: "Marcas",
    addNote: "Añadir nota",
    editNote: "Editar nota",
    favorite: "Favorito",
    unfavorite: "Quitar de favoritos",
    highlight: "Resaltar",
    highlightColor: "Color del resaltado",
    removeHighlight: "Quitar resaltado",
    moreActions: "Más",
    copyVerse: "Copiar texto",
    clearMarks: "Quitar marcas",
    note: "Nota",
    notePlaceholder: "Lo que este pasaje te dice…",
    deleteNote: "Eliminar nota",
    close: "Cerrar",
    marksIdle: "Selecciona un versículo en el lector para marcarlo, resaltarlo o anotarlo.",
    allMarks: "Todas",
    favorites: "Favoritos",
    highlights: "Resaltados",
    notes: "Notas",
    noMarks: "Todavía no hay nada marcado.",
    selectedVerses: "seleccionados",
    offlineDownload: "Descargar para usar sin conexión · %s",
    offlineDownloading: "Descargando… %p",
    offlineInstalling: "Instalando…",
    offlineCancel: "Cancelar descarga",
    offlineAvailable: "Disponible sin conexión",
    offlineUpdate: "Actualización disponible",
    offlineUpdateAction: "Actualizar · %s",
    offlineRemove: "Eliminar descarga",
    offlineRemoving: "Eliminando…",
    offlineChecksum: "La descarga llegó dañada (la suma de verificación no coincide). Inténtalo de nuevo.",
    offlineRetry: "Reintentar",
    offlineBadge: "sin conexión",
    offlineVerses: "%n versículos en este dispositivo",
    studyTab: "Sermón",
    studies: "Sermones",
    addToStudy: "Al estudio",
    inStudy: "En el estudio",
    addRefToStudy: "Añadir al estudio actual",
    refInStudy: "Ya está en el estudio actual",
    openInReader: "Abrir en el lector",
    untitledStudy: "Estudio sin título",
    studyIdle: "Reúne pasajes para un sermón o una lección: selecciona versículos en el lector, o pregúntale al asistente, y añádelos a un estudio.",
    newStudy: "Nuevo estudio",
    openStudy: "Abrir estudio",
    currentStudy: "Estudio actual",
    noPassages: "Aún no hay pasajes.",
    passagesN: "%n pasajes",
    removePassage: "Quitar del estudio",
    studyTitlePlaceholder: "Título del sermón o estudio",
    studyBodyPlaceholder: "Escribe tu bosquejo, notas y aplicación…",
    passages: "Pasajes",
    insertIntoNotes: "Insertar en las notas",
    moveUp: "Subir",
    moveDown: "Bajar",
    exportPdf: "Exportar PDF",
    exporting: "Exportando…",
    exported: "PDF guardado",
    exportError: "No se pudo guardar el PDF.",
    deleteStudy: "Eliminar estudio",
    confirmDelete: "¿Eliminar definitivamente?",
    backToReader: "Lector",
    editedAt: "Editado %s",
    studyNotFound: "Este estudio ya no existe.",
    textPending: "Cargando texto…",
    fromAssistant: "Sugerido por el asistente",
    fmtBold: "Negrita",
    fmtItalic: "Cursiva",
    fmtHeading: "Título",
    fmtSubheading: "Subtítulo",
    fmtBullets: "Lista con viñetas",
    fmtNumbers: "Lista numerada",
    fmtQuote: "Cita",
    fmtAlignLeft: "Alinear a la izquierda",
    fmtAlignCenter: "Centrar",
    fmtAlignRight: "Alinear a la derecha",
    fmtJustify: "Justificar",
    fmtRule: "Línea divisoria",
    fmtLink: "Enlace",
    fmtImage: "Insertar imagen",
    fmtVideo: "Insertar video de YouTube",
    watchOnYoutube: "Ver en YouTube",
    linkUrl: "Dirección del enlace",
    videoUrl: "Enlace de YouTube",
    applyUrl: "Aplicar",
    removeLink: "Quitar enlace",
    invalidVideo: "Ese no es un enlace de YouTube.",
    imageError: "No se pudo añadir esa imagen.",
    ss1: "Sugiere versículos clave para este estudio",
    ss2: "Haz un bosquejo de sermón de tres puntos sobre este tema",
    ss3: "¿Qué referencias cruzadas apoyan este tema?"
  }
};
