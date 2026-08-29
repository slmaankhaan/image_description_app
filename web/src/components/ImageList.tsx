import type { ApiImage } from '../api';

interface ImageListProps {
  images: ApiImage[];
}

export function ImageList({ images }: ImageListProps) {
  if (images.length === 0) {
    return <p className="image-list__empty">No images yet. Upload one to get started.</p>;
  }

  return (
    <ul className="image-list">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
    </ul>
  );
}

function ImageCard({ image }: { image: ApiImage }) {
  return (
    <li className="image-card">
      <img className="image-card__thumb" src={`/api/images/${image.id}/file`} alt={image.filename} />
      <div className="image-card__body">
        <p className="image-card__filename">{image.filename}</p>
        {image.status === 'pending' && (
          <p className="image-card__status image-card__status--pending">
            <span className="spinner" aria-hidden="true" />
            Generating description…
          </p>
        )}
        {image.status === 'ready' && <p className="image-card__description">{image.description}</p>}
        {image.status === 'failed' && (
          <p className="image-card__status image-card__status--failed">{image.errorMessage}</p>
        )}
      </div>
    </li>
  );
}
