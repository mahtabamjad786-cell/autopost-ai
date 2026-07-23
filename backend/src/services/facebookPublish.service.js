import axios from 'axios';
import path from 'path';

const FB_VERSION = process.env.FB_GRAPH_VERSION || 'v20.0';
const GRAPH = `https://graph.facebook.com/${FB_VERSION}`;

/**
 * Publishes a post (with optional image) to a connected Facebook Page.
 * Returns the Facebook post id.
 */
export async function publishToFacebook({ page, message, imageUrl, serverBaseUrl }) {
  // No image: simple text post to the Page feed.
  if (!imageUrl) {
    const { data } = await axios.post(`${GRAPH}/${page.pageId}/feed`, null, {
      params: { message, access_token: page.accessToken },
    });
    return data.id;
  }

  // With image: Facebook's /photos endpoint needs a publicly reachable URL.
  const absoluteImageUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${serverBaseUrl}${imageUrl}`;

  const { data } = await axios.post(`${GRAPH}/${page.pageId}/photos`, null, {
    params: {
      url: absoluteImageUrl,
      caption: message,
      access_token: page.accessToken,
    },
  });
  return data.post_id || data.id;
}
