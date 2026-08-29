import { useCallback, useEffect, useState } from 'react';
import type { ApiImage } from './api';
import { fetchImages } from './api';
import { ImageList } from './components/ImageList';
import { UploadForm } from './components/UploadForm';

const POLL_INTERVAL_MS = 2000;

export function App() {
  const [images, setImages] = useState<ApiImage[]>([]);

  const loadImages = useCallback(async () => {
    try {
      setImages(await fetchImages());
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  const hasPending = images.some((image) => image.status === 'pending');

  // Runs only while a row is pending; its cleanup (on the next render once
  // hasPending flips false, or on unmount) is what stops the interval.
  useEffect(() => {
    if (!hasPending) {
      return;
    }
    const interval = setInterval(() => void loadImages(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasPending, loadImages]);

  function handleUploaded(image: ApiImage): void {
    setImages((current) => [image, ...current]);
  }

  return (
    <main className="app">
      <h1>Image Description App</h1>
      <UploadForm onUploaded={handleUploaded} />
      <ImageList images={images} />
    </main>
  );
}
