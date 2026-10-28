import asyncio
import logging
import secrets
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_kode_otp() -> str:
    """Menghasilkan 6 digit kode OTP numerik acak secara kriptografis."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_smtp_sync(email_tujuan: str, nama: str, satuan_kerja: str, kode_otp: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = f"[{kode_otp}] Kode Verifikasi OTP Portal IKK Komdigi"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = email_tujuan

    text_body = (
        f"Yth. {nama} ({satuan_kerja}),\n\n"
        f"Kode verifikasi OTP untuk pendaftaran akun Portal Pra-SI IKK Komdigi Anda adalah:\n\n"
        f"    {kode_otp}\n\n"
        f"Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun.\n"
        f"Setelah memverifikasi kode OTP ini, akun Anda akan diteruskan ke Admin/Koordinator "
        f"PUSAKA untuk validasi kesesuaian Satuan Kerja.\n\n"
        f"Salam,\nTim Portal IKK Kementerian Komunikasi dan Digital"
    )
    msg.set_content(text_body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def kirim_email_otp(email_tujuan: str, nama: str, satuan_kerja: str, kode_otp: str) -> bool:
    """
    Mengirim email berisi 6 digit kode OTP ke alamat email @komdigi.go.id.
    Mengembalikan True jika terkirim lewat server SMTP, atau False jika menggunakan
    mode simulasi log (ketika SMTP_HOST belum dikonfigurasi).
    """
    if not settings.SMTP_HOST.strip():
        logger.info(
            "[OTP-EMAIL-SIMULASI] Email: %s | Nama: %s | Kode OTP: %s",
            email_tujuan,
            nama,
            kode_otp,
        )
        return False

    try:
        await asyncio.to_thread(_send_smtp_sync, email_tujuan, nama, satuan_kerja, kode_otp)
        return True
    except Exception as exc:
        logger.warning("Gagal mengirim email OTP melalui SMTP ke %s: %s", email_tujuan, exc)
        return False
