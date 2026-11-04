
import type { CollectionEntry } from 'astro:content';

// Get all images from the content directory
const allImages = import.meta.glob<{ default: ImageMetadata }>(
    '/public/images/articles/*'
);

export async function getArticleImage(article: CollectionEntry<'articles'>) {
    const imagePath = article.data.image;
    if (!imagePath) {
        throw new Error(`Image path is missing for article: ${article.slug}`);
    }

    if (imagePath.startsWith('http')) {
        return imagePath;
    }

    // Find the matching image module in the glob import
    const imageModuleKey = Object.keys(allImages).find(key => key.endsWith(imagePath.split('/').pop()));

    if (!imageModuleKey) {
        throw new Error(`Could not find image module for path: ${imagePath}`);
    }

    const imageModule = await allImages[imageModuleKey]();
    return imageModule.default;
}
