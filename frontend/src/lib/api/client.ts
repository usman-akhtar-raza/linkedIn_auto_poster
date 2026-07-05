"use client";

import { getSession } from "next-auth/react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (!session?.accessToken) {
    throw new Error("Your session is missing an API token. Please sign out and sign in again.");
  }

  headers.set("Authorization", `Bearer ${session.accessToken}`);

  if (init.method && init.method !== "GET") {
    headers.set("X-CSRF-Token", readCookie("csrf_token") ?? "");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(resolveErrorMessage(error));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function resolveErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return "Request failed";
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === "string") {
    return message;
  }

  if (message && typeof message === "object") {
    const nestedMessage = (message as { message?: unknown }).message;
    if (typeof nestedMessage === "string") {
      return nestedMessage;
    }
  }

  return "Request failed";
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return undefined;
  }

  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")[1];
}
