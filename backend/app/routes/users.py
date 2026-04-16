from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead
from app.core.security import get_password_hash
from app.dependencies.auth import get_current_user, require_admin
from app.services.audit import log_action

router = APIRouter(tags=["users"])

@router.post("/users", response_model=UserRead)
def create_user(
    user_in: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    user = session.exec(select(User).where(User.username == user_in.username)).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    db_user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role
    )
    session.add(db_user)
    session.flush()
    log_action(
        session,
        user_id=current_user.id,
        action="CREATE_USER",
        entity_type="USER",
        entity_id=str(db_user.id),
        details=f"Created user: {db_user.username} (role: {db_user.role})"
    )
    session.commit()
    session.refresh(db_user)
    return db_user

@router.get("/users", response_model=List[UserRead])
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    users = session.exec(select(User)).all()
    return users

@router.get("/users/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/users/{user_id}/toggle-active", response_model=UserRead)
def toggle_user_active(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot disable an admin account")
    user.is_active = not user.is_active
    session.add(user)
    session.flush()
    log_action(
        session,
        user_id=current_user.id,
        action="TOGGLE_USER_ACTIVE",
        entity_type="USER",
        entity_id=str(user.id),
        details=f"Set user {user.username} active={user.is_active}"
    )
    session.commit()
    session.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting the last admin or yourself
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    log_action(
        session,
        user_id=current_user.id,
        action="DELETE_USER",
        entity_type="USER",
        entity_id=str(user.id),
        details=f"Deleted user: {user.username}"
    )
    session.delete(user)
    session.commit()
    return {"message": "User deleted successfully"}
