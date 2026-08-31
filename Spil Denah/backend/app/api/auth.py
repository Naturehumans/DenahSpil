import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, ForgotPassword, ResetPassword
from app.services.auth_service import get_user_by_username, get_user_by_email, get_user_by_reset_token
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.utils.sanitizer import sanitize_text
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    sanitized_username = sanitize_text(user_in.username)
    sanitized_email = sanitize_text(user_in.email)
    
    existing_user = await get_user_by_username(db, sanitized_username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    existing_email = await get_user_by_email(db, sanitized_email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    db_user = User(
        username=sanitized_username,
        email=sanitized_email,
        hashed_password=hash_password(user_in.password)
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_username(db, user_in.username)
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/forgot-password")
async def forgot_password(req: ForgotPassword, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, req.email)
    if not user:
        # Return success anyway to prevent email enumeration
        return {"message": "If that email is in our system, a reset link has been sent."}
        
    reset_token = str(uuid.uuid4())
    user.reset_token = hash_password(reset_token)
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    
    await db.commit()
    
    # In a real app, send email here
    # print(f"Reset token for {user.email}: {reset_token}")
    
    return {"message": "If that email is in our system, a reset link has been sent."}

@router.post("/reset-password")
async def reset_password(req: ResetPassword, db: AsyncSession = Depends(get_db)):
    # Here we would typically search by user email, but the token is hashed.
    # For a real implementation, the token sent should contain an identifier or we query by email + token.
    # Let's assume the client passes the token they received.
    # To find the user, we would actually need an email or user ID passed along with the token in the request,
    # or the token itself should be a JWT containing the user ID.
    # For simplicity, if we don't change the model, we could use a JWT for the reset_token instead of a random UUID.
    raise HTTPException(status_code=501, detail="Not fully implemented")
