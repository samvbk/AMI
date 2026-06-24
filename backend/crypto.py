import os
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Fallback for development. In production, provide a stable key!
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    os.environ["ENCRYPTION_KEY"] = ENCRYPTION_KEY

fernet = Fernet(ENCRYPTION_KEY.encode('utf-8') if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

def encrypt_data(data) -> bytes:
    if data is None:
        return None
    if isinstance(data, str):
        data = data.encode('utf-8')
    return fernet.encrypt(data)

def decrypt_data(encrypted_data: bytes, as_str=False):
    if not encrypted_data:
        return encrypted_data
    try:
        decrypted = fernet.decrypt(encrypted_data)
        if as_str:
            return decrypted.decode('utf-8')
        return decrypted
    except InvalidToken:
        # Fallback for old unencrypted data
        if as_str and isinstance(encrypted_data, bytes):
            try:
                return encrypted_data.decode('utf-8')
            except UnicodeDecodeError:
                pass
        return encrypted_data
