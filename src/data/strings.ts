export type Locale = "en" | "es";

export interface StringsShape {
  refPlaceholder: string;
  compare: string;
  panel: string;
  theme: string;
  apiKey: string;
  aiApiKey: string;
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
  keySet: string;
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
  fmtParagraph: string;
  fmtBullets: string;
  fmtNumbers: string;
  fmtQuote: string;
  ss1: string;
  ss2: string;
  ss3: string;
}

export const STR: Record<Locale, StringsShape> = {
  en: {
    refPlaceholder: "Go to reference — John 3:16",
    compare: "Compare",
    panel: "Study",
    theme: "Theme",
    apiKey: "BibleQL API key",
    aiApiKey: "Anthropic API key",
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
    noKey: "No API key — showing a bundled sample chapter.",
    keySet: "Key saved",
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
    studies: "Studies",
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
    fmtParagraph: "Body text",
    fmtBullets: "Bulleted list",
    fmtNumbers: "Numbered list",
    fmtQuote: "Quote",
    ss1: "Suggest key verses for this study",
    ss2: "Outline a three-point sermon on this theme",
    ss3: "Which cross-references support this theme?"
  },
  es: {
    refPlaceholder: "Ir a la referencia — Juan 3:16",
    compare: "Comparar",
    panel: "Estudio",
    theme: "Tema",
    apiKey: "Clave de API de BibleQL",
    aiApiKey: "Clave de API de Anthropic",
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
    noKey: "Sin clave de API — mostrando un capítulo de muestra.",
    keySet: "Clave guardada",
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
    studies: "Estudios",
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
    fmtParagraph: "Texto normal",
    fmtBullets: "Lista con viñetas",
    fmtNumbers: "Lista numerada",
    fmtQuote: "Cita",
    ss1: "Sugiere versículos clave para este estudio",
    ss2: "Haz un bosquejo de sermón de tres puntos sobre este tema",
    ss3: "¿Qué referencias cruzadas apoyan este tema?"
  }
};
