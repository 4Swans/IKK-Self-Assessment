export async function bukaBerkasTerotentikasi(
  url: string,
  fallbackFilename = "dokumen"
): Promise<void> {
  const token = localStorage.getItem("ikk_token");
  const res = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    let pesan = "Gagal membuka atau mengunduh berkas dari server.";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") {
        pesan = body.detail;
      }
    } catch {
      // Abaikan bila respons bukan JSON
    }
    throw new Error(pesan);
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const contentDisp = res.headers.get("Content-Disposition") || "";

  if (contentDisp.toLowerCase().startsWith("attachment")) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fallbackFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }

  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}
