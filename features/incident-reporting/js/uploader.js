// uploader.js
// Drag-and-drop file upload handler for Step 3
// Validates, reads via FileReader, generates canvas thumbnails

const Uploader = (() => {
  const ALLOWED_TYPES = ['image/png','image/jpeg','image/webp','application/pdf'];
  const MAX_SIZE      = 5 * 1024 * 1024;  // 5 MB
  const MAX_FILES     = 3;
  const THUMB_SIZE    = 200;              // px — max dimension for stored thumbnail

  let _files    = [];
  let _onUpdate = () => {};

  function init(zoneId, inputId, onUpdate) {
    _onUpdate = onUpdate || _onUpdate;
    const zone  = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', e => _handleFiles(e.target.files));

    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      _handleFiles(e.dataTransfer.files);
    });
  }

  function _handleFiles(fileList) {
    _showError('');
    Array.from(fileList).forEach(file => {
      if (_files.length >= MAX_FILES)      return _showError(`Maximum ${MAX_FILES} files allowed.`);
      if (!ALLOWED_TYPES.includes(file.type)) return _showError(`"${file.name}" is not a supported type. Use PNG, JPG, WEBP, or PDF.`);
      if (file.size > MAX_SIZE)           return _showError(`"${file.name}" exceeds the 5 MB limit.`);

      const reader = new FileReader();
      reader.onload = e => {
        const fileData = { name: file.name, size: file.size, type: file.type, previewUrl: null };

        if (file.type.startsWith('image/')) {
          _generateThumbnail(e.target.result, thumb => {
            fileData.previewUrl = thumb;
            _files.push(fileData);
            _onUpdate([..._files]);
          });
        } else {
          _files.push(fileData);
          _onUpdate([..._files]);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function _generateThumbnail(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
      const scale  = Math.min(THUMB_SIZE / img.width, THUMB_SIZE / img.height, 1);
      const w      = Math.round(img.width  * scale);
      const h      = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = dataUrl;
  }

  function removeFile(index) {
    _files.splice(index, 1);
    _onUpdate([..._files]);
  }

  function getFiles()  { return [..._files]; }
  function clearFiles(){ _files = []; }

  function _showError(msg) {
    const el = document.getElementById('uploadError');
    if (el) el.textContent = msg;
  }

  function formatBytes(bytes) {
    if (bytes < 1024)            return bytes + ' B';
    if (bytes < 1024 * 1024)     return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { init, removeFile, getFiles, clearFiles, formatBytes };
})();
