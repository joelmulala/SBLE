export function buildFileUploadFormData({ file, courseId, title, fields = {} }) {
  const formData = new FormData();

  if (file) {
    formData.append('file', file);
  }

  if (courseId !== undefined && courseId !== null && courseId !== '') {
    const normalizedCourseId = Number(courseId);
    formData.append('courseId', String(Number.isFinite(normalizedCourseId) && normalizedCourseId > 0 ? normalizedCourseId : courseId));
  }

  if (typeof title === 'string' && title.trim()) {
    formData.append('title', title.trim());
  }

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });

  return formData;
}

export function triggerBlobDownload(response, fallbackName = 'download') {
  const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data]);
  const disposition = response?.headers?.['content-disposition'] || response?.headers?.get?.('content-disposition') || '';
  const fileName = parseFileNameFromDisposition(disposition, fallbackName);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function parseFileNameFromDisposition(disposition, fallbackName) {
  if (!disposition) return fallbackName;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] || fallbackName;
}
