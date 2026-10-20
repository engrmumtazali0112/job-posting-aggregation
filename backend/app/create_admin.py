import sys
from .database import SessionLocal, Base, engine
from .models import User
from .security import hash_password

Base.metadata.create_all(bind=engine)
email, password = sys.argv[1], sys.argv[2]
db = SessionLocal()
db.add(User(email=email.lower(), password_hash=hash_password(password), role="admin", is_verified=True))
db.commit()
print("Admin created:", email)