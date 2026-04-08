import { Rootbeer } from '../types/Rootbeer';

interface PagedRootbeerResponse {
  rootbeers: Rootbeer[];
  totalCount: number;
}

export interface RootbeerInput {
  rootbeerName: string;
  firstBrewedYear: string;
  breweryName: string;
  city: string;
  state: string;
  country: string;
  description: string;
  wholesaleCost: number;
  currentRetailPrice: number;
  container: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

async function readApiError(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return fallbackMessage;
  }

  const data = await response.json();

  if (typeof data?.detail === 'string' && data.detail.length > 0) {
    return data.detail;
  }

  if (typeof data?.title === 'string' && data.title.length > 0) {
    return data.title;
  }

  return fallbackMessage;
}

export async function getRootbeers(
  pageSize: number,
  pageNum: number,
  selectedContainers: string[]
): Promise<PagedRootbeerResponse> {
  const searchParams = new URLSearchParams({
    pageSize: pageSize.toString(),
    pageNum: pageNum.toString(),
  });

  selectedContainers.forEach((container) => {
    searchParams.append('containers', container);
  });

  const response = await fetch(`${apiBaseUrl}/api/rootbeers?${searchParams}`);

  if (!response.ok) {
    throw new Error('Unable to load rootbeers.');
  }

  return response.json();
}

export async function getContainerTypes(): Promise<string[]> {
  const response = await fetch(`${apiBaseUrl}/api/rootbeers/containers`);

  if (!response.ok) {
    throw new Error('Unable to load container types.');
  }

  return response.json();
}

export async function getManagedRootbeers(): Promise<Rootbeer[]> {
  const response = await fetch(`${apiBaseUrl}/api/rootbeers/admin`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Unable to load admin rootbeers.')
    );
  }

  return response.json();
}

export async function createRootbeer(
  rootbeer: RootbeerInput
): Promise<Rootbeer> {
  const response = await fetch(`${apiBaseUrl}/api/rootbeers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(rootbeer),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Unable to create the rootbeer.')
    );
  }

  return response.json();
}
