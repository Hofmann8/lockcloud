"""
Email service for sending verification codes and other emails
"""
from datetime import datetime, timedelta
from flask import current_app, render_template_string
from flask_mail import Message
from app import db, mail
from auth.models import VerificationCode


def generate_verification_code(email):
    """
    Generate a new verification code for the given email address.
    
    Args:
        email: Email address to generate code for
        
    Returns:
        VerificationCode: New verification code instance
    """
    # Create new verification code
    verification_code = VerificationCode.create_code(email)
    db.session.add(verification_code)
    db.session.commit()
    
    return verification_code


def send_verification_email(email, code):
    """
    Send verification code email to the user.
    
    Args:
        email: Recipient email address
        code: 6-digit verification code
        
    Returns:
        bool: True if email sent successfully, False otherwise
        
    Raises:
        Exception: If email sending fails
    """
    try:
        # Load HTML template
        html_template_path = 'auth/templates/verification_email.html'
        text_template_path = 'auth/templates/verification_email.txt'
        
        # Read template files with UTF-8 encoding
        with current_app.open_resource(html_template_path) as f:
            html_template = f.read().decode('utf-8')
        
        with current_app.open_resource(text_template_path) as f:
            text_template = f.read().decode('utf-8')
        
        # Render templates with code
        html_body = render_template_string(html_template, code=code)
        text_body = render_template_string(text_template, code=code)
        
        # Create message
        msg = Message(
            subject='LockCloud 邮箱验证码',
            recipients=[email],
            html=html_body,
            body=text_body
        )
        
        # Send email
        mail.send(msg)
        
        current_app.logger.info(f'Verification email sent to {email}')
        return True
        
    except Exception as e:
        current_app.logger.error(f'Failed to send verification email to {email}: {str(e)}')
        raise Exception(f'发送验证邮件失败: {str(e)}')


def send_verification_code(email):
    """
    Generate and send a verification code to the given email address.
    This is a convenience function that combines generation and sending.
    
    Args:
        email: Email address to send verification code to
        
    Returns:
        dict: Result with success status and message
        
    Raises:
        ValueError: If rate limit is exceeded or email is invalid
        Exception: If email sending fails
    """
    # Validate email format
    if not email or '@' not in email:
        raise ValueError('邮箱格式不正确')
    
    # Validate ZJU email domain
    if not email.lower().endswith('@zju.edu.cn'):
        raise ValueError('邮箱必须是浙江大学邮箱 (@zju.edu.cn)')
    
    # Generate verification code
    verification_code = generate_verification_code(email)
    
    # Send email
    send_verification_email(email, verification_code.code)
    
    return {
        'success': True,
        'message': '验证码已发送到您的邮箱',
        'expires_in': 600  # 10 minutes in seconds
    }


def validate_verification_code(email, code):
    """
    Validate a verification code for the given email address.
    Checks if the code exists, is not expired, and has not been used.
    Marks the code as used after successful validation.
    
    Args:
        email: Email address to validate code for
        code: 6-digit verification code to validate
        
    Returns:
        dict: Result with success status and message
        
    Raises:
        ValueError: If code is invalid, expired, or already used
    """
    # Find the most recent unused code for this email
    verification_code = VerificationCode.query.filter_by(
        email=email,
        code=code,
        used=False
    ).order_by(VerificationCode.created_at.desc()).first()
    
    # Check if code exists
    if not verification_code:
        raise ValueError('验证码不正确')
    
    # Check if code is expired (10 minutes)
    if verification_code.is_expired():
        raise ValueError('验证码已过期，请重新获取')
    
    # Mark code as used
    verification_code.mark_as_used()
    db.session.commit()
    
    current_app.logger.info(f'Verification code validated for {email}')
    
    return {
        'success': True,
        'message': '验证码验证成功',
        'email': email
    }
