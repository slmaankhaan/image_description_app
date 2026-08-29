import { useRef, useState } from 'react';
import type { ApiImage } from '../api';
import { uploadImage } from '../api';

interface UploadFormProps {
  onUploaded: (image: ApiImage) => void;
}

export function UploadForm({ onUploaded }: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const image = await uploadImage(file);
      onUploaded(image);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <input ref={fileInputRef} type="file" accept="image/*" disabled={uploading} />
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
      {error && <p className="upload-form__error">{error}</p>}
    </form>
  );
}
