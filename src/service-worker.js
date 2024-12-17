// src/custom-sw.js
console.log("[ServiceWorker] Starting");

const serverSupportMap = {};
const pendingAuthRequests = new Map(); // Map to track pending auth requests

// Constants for media paths
const MEDIA_DOWNLOAD_PREFIX = "/_matrix/media/v3/download";
const MEDIA_THUMBNAIL_PREFIX = "/_matrix/media/v3/thumbnail";
const MEDIA_AUTHED_PREFIX = "/_matrix/client/v1/media";

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch event
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Check if the URL is a Matrix media request
  if (
    !url.pathname.startsWith(MEDIA_DOWNLOAD_PREFIX) &&
    !url.pathname.startsWith(MEDIA_THUMBNAIL_PREFIX) &&
    !url.pathname.startsWith(MEDIA_AUTHED_PREFIX)
  )
    return;

  event.respondWith(handleMediaRequest(event, url));
});

// Handle media requests
async function handleMediaRequest(event, url) {
  try {
    // Get the client that made the request
    const client = await self.clients.get(event.clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    const auth = await getAuthData(client);

    // Update server support map (if needed)
    // await updateServerSupportMap(url.origin, auth.accessToken);

    // Rewrite to authenticated media URL (if supported)
    // if (serverSupportMap[url.origin]?.supportsAuthedMedia) {
    //   url.pathname = url.pathname.replace(
    //     /\/media\/v3\/(.*)\//,
    //     "/client/v1/media/$1/"
    //   );
    // }

    // Add Authorization header and fetch
    const fetchConfig = fetchConfigForToken(auth?.accessToken);
    const response = await fetch(url.toString(), fetchConfig);

    // Handle non-2xx responses
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch media: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response;
  } catch (error) {
    console.error("Error handling media request:", error);
    return new Response(
      `Failed to load media content: ${error.message || "Unknown error"}`,
      { status: 500 }
    );
  }
}

// Update server support map (with optimization)
async function updateServerSupportMap(serverUrl, accessToken) {
  const cachedData = serverSupportMap[serverUrl];
  const now = Date.now();

  // Only update if not cached or cache is about to expire (within 5 minutes)
  if (cachedData && cachedData.cacheExpiryTimeMs - now > 5 * 60 * 1000) {
    return;
  }

  try {
    const config = fetchConfigForToken(accessToken);
    const response = await fetch(
      `${serverUrl}/_matrix/client/versions`,
      config
    );
    const data = await response.json();
    serverSupportMap[serverUrl] = {
      supportsAuthedMedia: data?.versions?.includes("v1.11"),
      cacheExpiryTimeMs: now + 2 * 60 * 60 * 1000, // Cache for 2 hours
    };
    console.log(
      `[ServiceWorker] serverSupportMap update for '${serverUrl}': ${JSON.stringify(
        serverSupportMap[serverUrl]
      )}`
    );
  } catch (error) {
    console.error("Failed to update server support map:", error);
  }
}

// Retrieve authentication data (with improved request tracking and error handling)
async function getAuthData(client) {
  console.log(`[ServiceWorker] Getting auth data for client '${client.id}'`);
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID(); // Generate a unique request ID
    const timeoutId = setTimeout(() => {
      pendingAuthRequests.delete(requestId);
      reject(new Error("Timeout while retrieving auth data"));
    }, 10000); // Increased timeout

    pendingAuthRequests.set(requestId, { resolve, reject, timeoutId });

    console.log(
      `[ServiceWorker] Sending auth request to client '${client.id}', requestId: ${requestId}`
    );

    try {
      client.postMessage({ requestId, type: "authRequest" }, []);
    } catch (error) {
      console.error("Error sending message to client:", error);
      clearTimeout(timeoutId);
      pendingAuthRequests.delete(requestId);
      reject(new Error("Failed to send message to client"));
    }
  });
}

// Message listener for handling responses from the client
self.addEventListener("message", (event) => {
  // Check the origin of the message for security
  // if (event.origin !== "YOUR_EXPECTED_CLIENT_ORIGIN") {
  //   console.warn(`[ServiceWorker] Ignoring message from unexpected origin: ${event.origin}`);
  //   return;
  // }

  const { data } = event;
  if (data?.type !== "authResponse" || !data.requestId) {
    return;
  }

  const request = pendingAuthRequests.get(data.requestId);
  if (!request) {
    console.warn(
      `[ServiceWorker] Received auth response for unknown request ID: ${data.requestId}`
    );
    return;
  }

  clearTimeout(request.timeoutId);
  pendingAuthRequests.delete(data.requestId);

  if (data.error) {
    request.reject(new Error(data.error));
  } else {
    request.resolve(data);
  }
});

// Fetch configuration with Authorization header
function fetchConfigForToken(accessToken) {
  if (!accessToken) {
    return undefined;
  }

  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}
