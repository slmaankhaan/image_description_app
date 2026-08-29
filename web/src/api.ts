export type ImageStatus = 'pending' | 'ready' | 'failed';

export interface ApiImage {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  status: ImageStatus;
  errorMessage: string | null;
  createdAt: string;
}

interface ImagesListResponse {
  images: ApiImage[];
}

interface ImageResponse {
  image: ApiImage;
}

interface ErrorResponse {
  error: { code: string; message: string; details?: unknown };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorResponse;
    return body.error.message;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function fetchImages(): Promise<ApiImage[]> {
  const response = await fetch('/api/images');
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const body = (await response.json()) as ImagesListResponse;
  return body.images;
}

export async function uploadImage(file: File): Promise<ApiImage> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/images', { method: 'POST', body: formData });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const body = (await response.json()) as ImageResponse;
  return body.image;
}
