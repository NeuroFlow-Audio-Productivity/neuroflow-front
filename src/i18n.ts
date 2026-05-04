import { createI18n } from 'vue-i18n'

export type Locale = 'en' | 'ja' | 'pt-BR' | 'es'

export const supportedLocales: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JP' },
  { code: 'pt-BR', label: 'PT-BR' },
  { code: 'es', label: 'ES' },
]

const STORAGE_KEY = 'neuroflow-locale'

const authMessages = {
  en: {
    actions: {
      signIn: 'Sign in',
      createAccount: 'Create account',
      forgotPassword: 'Forgot password?',
      resendVerification: 'Resend verification',
      sendResetLink: 'Send reset link',
      resetPassword: 'Reset password',
      signOut: 'Sign out',
    },
    fields: {
      name: 'Name',
      email: 'Email',
      password: 'Password',
      passwordConfirmation: 'Confirm password',
    },
    validation: {
      required: 'The {field} field is required.',
      email: 'The {field} field must be a valid email address.',
      confirmed: 'The {field} confirmation does not match.',
      unique: 'The {field} has already been taken.',
      minString: 'The {field} field must be at least {min} characters.',
      maxString: 'The {field} field must not be greater than {max} characters.',
      string: 'The {field} field must be text.',
      invalid: 'The selected {field} is invalid.',
      alreadyVerified: 'This {field} is already verified.',
      default: 'The {field} field is invalid.',
      summaryMoreOne: ' (and {count} more error)',
      summaryMore: ' (and {count} more errors)',
    },
    api: {
      success: {
        login: 'Login successful.',
        register: 'Registration successful. Please verify your email address.',
        verificationSent: 'Verification email sent successfully.',
        emailVerified: 'Email verified successfully.',
        resetTokenReady: 'Use this token and email address to complete the password reset.',
        resetLinkSent: 'Password reset link sent successfully.',
        passwordReset: 'Password reset successfully.',
        logout: 'Logout successful.',
      },
      errors: {
        default: 'Something went wrong. Please try again.',
        network: 'Unable to reach the NeuroFlow API.',
        validation: 'Please review the highlighted fields.',
        credentials: 'These credentials do not match our records.',
        register: 'Unable to create this account.',
        verificationResend: 'Unable to resend the verification email.',
        verification: 'Unable to verify this email address.',
        resetLink: 'Unable to send the password reset link.',
        resetToken: 'Unable to load this password reset token.',
        passwordReset: 'Unable to reset this password.',
        profileItems: 'Unable to load your profile navigation.',
        localSessionCleared: 'The local session was cleared.',
        invalidSignature: 'This verification link is invalid or expired.',
        unauthenticated: 'Your session is not authenticated.',
        forbidden: 'You do not have permission to complete this action.',
        notFound: 'The requested resource was not found.',
        sessionExpired: 'Your session expired. Please try again.',
        tooManyAttempts: 'Too many attempts. Please wait a moment and try again.',
        emailNotVerified: 'Please verify your email address before signing in.',
        emailAlreadyVerified: 'This email address is already verified.',
        server: 'The server could not complete this request.',
      },
    },
    login: {
      eyebrow: 'Secure access',
      title: 'Welcome back to your flow.',
      subtitle:
        'Sign in with your verified NeuroFlow account and keep your session synced with the API token issued by Sanctum.',
      formTitle: 'Sign in',
      formSubtitle: 'Use the email and password you registered with.',
      resetComplete: 'Your password was reset. You can sign in with the new password.',
      noAccount: 'No account yet?',
    },
    register: {
      eyebrow: 'Start protected',
      title: 'Create your NeuroFlow account.',
      subtitle:
        'Registration sends a verification email before the API allows authenticated access.',
      formTitle: 'Create account',
      formSubtitle: 'After registration, check your email to verify the account.',
      hasAccount: 'Already have an account?',
    },
    verify: {
      eyebrow: 'Email verification',
      title: 'Check your inbox.',
      subtitle: 'Use the verification link sent by the API, or request a fresh email here.',
      linkTitle: 'Verifying your email.',
      linkSubtitle: 'This page validates the signed link with the API.',
      checking: 'Checking verification link...',
      formTitle: 'Resend verification email',
      formSubtitle: 'Enter the email address that needs a new verification message.',
    },
    forgot: {
      eyebrow: 'Account recovery',
      title: 'Recover your password.',
      subtitle: 'Request a reset link and continue the flow from the token route.',
      formTitle: 'Send reset link',
      formSubtitle: 'The API will email the password reset link to this address.',
    },
    reset: {
      eyebrow: 'New password',
      title: 'Choose a new password.',
      subtitle: 'The reset token from the link is sent back to the API with your new password.',
      formTitle: 'Reset password',
      formSubtitle: 'Use the email from the reset link and confirm the new password.',
    },
    dashboard: {
      eyebrow: 'Authenticated',
      title: 'Hi, {name}.',
      subtitle:
        'This protected view is loaded after the bearer token is stored and /user responds.',
      session: 'Current session',
      verified: 'Verified',
      unverified: 'Unverified',
      userId: 'User ID',
    },
  },
  ja: {
    actions: {
      signIn: 'サインイン',
      createAccount: 'アカウント作成',
      forgotPassword: 'パスワードを忘れた場合',
      resendVerification: '確認メールを再送',
      sendResetLink: 'リセットリンクを送信',
      resetPassword: 'パスワードを再設定',
      signOut: 'サインアウト',
    },
    fields: {
      name: '名前',
      email: 'メール',
      password: 'パスワード',
      passwordConfirmation: 'パスワード確認',
    },
    validation: {
      required: '{field}は必須です。',
      email: '{field}は有効なメールアドレスで入力してください。',
      confirmed: '{field}の確認が一致しません。',
      unique: 'この{field}はすでに使用されています。',
      minString: '{field}は{min}文字以上で入力してください。',
      maxString: '{field}は{max}文字以内で入力してください。',
      string: '{field}は文字列で入力してください。',
      invalid: '選択された{field}は無効です。',
      alreadyVerified: 'この{field}はすでに確認済みです。',
      default: '{field}の入力内容が無効です。',
      summaryMoreOne: '（他に{count}件のエラー）',
      summaryMore: '（他に{count}件のエラー）',
    },
    api: {
      success: {
        login: 'ログインしました。',
        register: '登録が完了しました。メールアドレスを確認してください。',
        verificationSent: '確認メールを送信しました。',
        emailVerified: 'メールアドレスを確認しました。',
        resetTokenReady: 'このトークンとメールアドレスでパスワード再設定を完了できます。',
        resetLinkSent: 'パスワード再設定リンクを送信しました。',
        passwordReset: 'パスワードを再設定しました。',
        logout: 'ログアウトしました。',
      },
      errors: {
        default: '問題が発生しました。もう一度お試しください。',
        network: 'NeuroFlow API に接続できません。',
        validation: '入力内容を確認してください。',
        credentials: 'この認証情報は登録内容と一致しません。',
        register: 'このアカウントを作成できません。',
        verificationResend: '確認メールを再送できません。',
        verification: 'このメールアドレスを確認できません。',
        resetLink: 'パスワード再設定リンクを送信できません。',
        resetToken: 'このパスワード再設定トークンを読み込めません。',
        passwordReset: 'このパスワードを再設定できません。',
        profileItems: 'プロフィールのナビゲーションを読み込めません。',
        localSessionCleared: 'ローカルセッションを削除しました。',
        invalidSignature: 'この確認リンクは無効、または期限切れです。',
        unauthenticated: 'セッションは認証されていません。',
        forbidden: 'この操作を完了する権限がありません。',
        notFound: 'リクエストされたリソースが見つかりません。',
        sessionExpired: 'セッションの有効期限が切れました。もう一度お試しください。',
        tooManyAttempts: '試行回数が多すぎます。少し待ってから再試行してください。',
        emailNotVerified: 'サインインする前にメールアドレスを確認してください。',
        emailAlreadyVerified: 'このメールアドレスはすでに確認済みです。',
        server: 'サーバーがこのリクエストを完了できませんでした。',
      },
    },
    login: {
      eyebrow: '安全なアクセス',
      title: 'あなたのフローへ戻る。',
      subtitle:
        '確認済みの NeuroFlow アカウントでサインインし、Sanctum が発行した API トークンでセッションを維持します。',
      formTitle: 'サインイン',
      formSubtitle: '登録したメールとパスワードを入力してください。',
      resetComplete: 'パスワードを再設定しました。新しいパスワードでサインインできます。',
      noAccount: 'まだアカウントがありませんか？',
    },
    register: {
      eyebrow: '保護された開始',
      title: 'NeuroFlow アカウントを作成。',
      subtitle: '登録後、認証アクセスの前に確認メールが送信されます。',
      formTitle: 'アカウント作成',
      formSubtitle: '登録後、メールを確認してアカウントを有効化してください。',
      hasAccount: 'すでにアカウントがありますか？',
    },
    verify: {
      eyebrow: 'メール確認',
      title: '受信箱を確認。',
      subtitle: 'API から届いた確認リンクを使うか、新しいメールをリクエストできます。',
      linkTitle: 'メールを確認中。',
      linkSubtitle: '署名付きリンクを API で検証しています。',
      checking: '確認リンクをチェックしています...',
      formTitle: '確認メールを再送',
      formSubtitle: '新しい確認メールが必要なメールアドレスを入力してください。',
    },
    forgot: {
      eyebrow: 'アカウント復旧',
      title: 'パスワードを復旧。',
      subtitle: 'リセットリンクをリクエストし、トークンルートから続行します。',
      formTitle: 'リセットリンクを送信',
      formSubtitle: 'API がこのアドレスへパスワードリセットリンクを送信します。',
    },
    reset: {
      eyebrow: '新しいパスワード',
      title: '新しいパスワードを選択。',
      subtitle: 'リンクのリセットトークンを新しいパスワードと一緒に API へ送信します。',
      formTitle: 'パスワード再設定',
      formSubtitle: 'リセットリンクのメールを使い、新しいパスワードを確認してください。',
    },
    dashboard: {
      eyebrow: '認証済み',
      title: 'こんにちは、{name}。',
      subtitle: 'ベアラートークン保存後、/user が応答すると表示される保護ビューです。',
      session: '現在のセッション',
      verified: '確認済み',
      unverified: '未確認',
      userId: 'ユーザー ID',
    },
  },
  ptBR: {
    actions: {
      signIn: 'Entrar',
      createAccount: 'Criar conta',
      forgotPassword: 'Esqueceu a senha?',
      resendVerification: 'Reenviar verificação',
      sendResetLink: 'Enviar link de reset',
      resetPassword: 'Redefinir senha',
      signOut: 'Sair',
    },
    fields: {
      name: 'Nome',
      email: 'Email',
      password: 'Senha',
      passwordConfirmation: 'Confirmar senha',
    },
    validation: {
      required: 'O campo {field} é obrigatório.',
      email: 'O campo {field} deve ser um email válido.',
      confirmed: 'A confirmação de {field} não confere.',
      unique: 'Este {field} já está em uso.',
      minString: 'O campo {field} deve ter pelo menos {min} caracteres.',
      maxString: 'O campo {field} não pode ter mais que {max} caracteres.',
      string: 'O campo {field} deve ser um texto.',
      invalid: 'O {field} selecionado é inválido.',
      alreadyVerified: 'Este {field} já foi verificado.',
      default: 'O campo {field} é inválido.',
      summaryMoreOne: ' (e mais {count} erro)',
      summaryMore: ' (e mais {count} erros)',
    },
    api: {
      success: {
        login: 'Login realizado com sucesso.',
        register: 'Cadastro realizado com sucesso. Verifique seu email.',
        verificationSent: 'Email de verificação enviado com sucesso.',
        emailVerified: 'Email verificado com sucesso.',
        resetTokenReady: 'Use este token e email para concluir a redefinição da senha.',
        resetLinkSent: 'Link de redefinição de senha enviado com sucesso.',
        passwordReset: 'Senha redefinida com sucesso.',
        logout: 'Logout realizado com sucesso.',
      },
      errors: {
        default: 'Algo deu errado. Tente novamente.',
        network: 'Não foi possível conectar à API do NeuroFlow.',
        validation: 'Revise os campos destacados.',
        credentials: 'Essas credenciais não correspondem aos nossos registros.',
        register: 'Não foi possível criar esta conta.',
        verificationResend: 'Não foi possível reenviar o email de verificação.',
        verification: 'Não foi possível verificar este email.',
        resetLink: 'Não foi possível enviar o link de redefinição de senha.',
        resetToken: 'Não foi possível carregar este token de redefinição de senha.',
        passwordReset: 'Não foi possível redefinir esta senha.',
        profileItems: 'Não foi possível carregar a navegação do seu perfil.',
        localSessionCleared: 'A sessão local foi encerrada.',
        invalidSignature: 'Este link de verificação é inválido ou expirou.',
        unauthenticated: 'Sua sessão não está autenticada.',
        forbidden: 'Você não tem permissão para concluir esta ação.',
        notFound: 'O recurso solicitado não foi encontrado.',
        sessionExpired: 'Sua sessão expirou. Tente novamente.',
        tooManyAttempts: 'Muitas tentativas. Aguarde um momento e tente novamente.',
        emailNotVerified: 'Verifique seu email antes de entrar.',
        emailAlreadyVerified: 'Este email já foi verificado.',
        server: 'O servidor não conseguiu concluir esta solicitação.',
      },
    },
    login: {
      eyebrow: 'Acesso seguro',
      title: 'Volte para o seu fluxo.',
      subtitle:
        'Entre com sua conta NeuroFlow verificada e mantenha a sessão sincronizada pelo token Sanctum da API.',
      formTitle: 'Entrar',
      formSubtitle: 'Use o email e a senha cadastrados.',
      resetComplete: 'Sua senha foi redefinida. Você já pode entrar com a nova senha.',
      noAccount: 'Ainda não tem conta?',
    },
    register: {
      eyebrow: 'Comece protegido',
      title: 'Crie sua conta NeuroFlow.',
      subtitle: 'O cadastro envia uma verificação por email antes do acesso autenticado na API.',
      formTitle: 'Criar conta',
      formSubtitle: 'Depois do cadastro, confira seu email para verificar a conta.',
      hasAccount: 'Já tem uma conta?',
    },
    verify: {
      eyebrow: 'Verificação de email',
      title: 'Confira sua caixa de entrada.',
      subtitle: 'Use o link enviado pela API ou solicite uma nova mensagem por aqui.',
      linkTitle: 'Verificando seu email.',
      linkSubtitle: 'Esta página valida o link assinado com a API.',
      checking: 'Verificando link...',
      formTitle: 'Reenviar email de verificação',
      formSubtitle: 'Informe o email que precisa receber uma nova mensagem de verificação.',
    },
    forgot: {
      eyebrow: 'Recuperação',
      title: 'Recupere sua senha.',
      subtitle: 'Solicite um link de reset e continue o fluxo pela rota com token.',
      formTitle: 'Enviar link de reset',
      formSubtitle: 'A API enviará o link de redefinição de senha para este endereço.',
    },
    reset: {
      eyebrow: 'Nova senha',
      title: 'Escolha uma nova senha.',
      subtitle: 'O token do link é enviado para a API junto com a nova senha.',
      formTitle: 'Redefinir senha',
      formSubtitle: 'Use o email do link de reset e confirme a nova senha.',
    },
    dashboard: {
      eyebrow: 'Autenticado',
      title: 'Olá, {name}.',
      subtitle: 'Esta área protegida carrega depois do token bearer ser salvo e /user responder.',
      session: 'Sessão atual',
      verified: 'Verificado',
      unverified: 'Não verificado',
      userId: 'ID do usuário',
    },
  },
  es: {
    actions: {
      signIn: 'Entrar',
      createAccount: 'Crear cuenta',
      forgotPassword: '¿Olvidaste la contraseña?',
      resendVerification: 'Reenviar verificación',
      sendResetLink: 'Enviar enlace de reset',
      resetPassword: 'Restablecer contraseña',
      signOut: 'Salir',
    },
    fields: {
      name: 'Nombre',
      email: 'Email',
      password: 'Contraseña',
      passwordConfirmation: 'Confirmar contraseña',
    },
    validation: {
      required: 'El campo {field} es obligatorio.',
      email: 'El campo {field} debe ser un email válido.',
      confirmed: 'La confirmación de {field} no coincide.',
      unique: 'Este {field} ya está en uso.',
      minString: 'El campo {field} debe tener al menos {min} caracteres.',
      maxString: 'El campo {field} no debe tener más de {max} caracteres.',
      string: 'El campo {field} debe ser texto.',
      invalid: 'El {field} seleccionado no es válido.',
      alreadyVerified: 'Este {field} ya fue verificado.',
      default: 'El campo {field} no es válido.',
      summaryMoreOne: ' (y {count} error más)',
      summaryMore: ' (y {count} errores más)',
    },
    api: {
      success: {
        login: 'Inicio de sesión exitoso.',
        register: 'Registro exitoso. Verifica tu email.',
        verificationSent: 'Email de verificación enviado correctamente.',
        emailVerified: 'Email verificado correctamente.',
        resetTokenReady: 'Usa este token y email para completar el restablecimiento de contraseña.',
        resetLinkSent: 'Enlace de restablecimiento enviado correctamente.',
        passwordReset: 'Contraseña restablecida correctamente.',
        logout: 'Sesión cerrada correctamente.',
      },
      errors: {
        default: 'Algo salió mal. Inténtalo de nuevo.',
        network: 'No se pudo conectar con la API de NeuroFlow.',
        validation: 'Revisa los campos destacados.',
        credentials: 'Estas credenciales no coinciden con nuestros registros.',
        register: 'No se pudo crear esta cuenta.',
        verificationResend: 'No se pudo reenviar el email de verificación.',
        verification: 'No se pudo verificar este email.',
        resetLink: 'No se pudo enviar el enlace de restablecimiento.',
        resetToken: 'No se pudo cargar este token de restablecimiento.',
        passwordReset: 'No se pudo restablecer esta contraseña.',
        profileItems: 'No se pudo cargar la navegación de tu perfil.',
        localSessionCleared: 'La sesión local fue cerrada.',
        invalidSignature: 'Este enlace de verificación es inválido o expiró.',
        unauthenticated: 'Tu sesión no está autenticada.',
        forbidden: 'No tienes permiso para completar esta acción.',
        notFound: 'No se encontró el recurso solicitado.',
        sessionExpired: 'Tu sesión expiró. Inténtalo de nuevo.',
        tooManyAttempts: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
        emailNotVerified: 'Verifica tu email antes de entrar.',
        emailAlreadyVerified: 'Este email ya fue verificado.',
        server: 'El servidor no pudo completar esta solicitud.',
      },
    },
    login: {
      eyebrow: 'Acceso seguro',
      title: 'Vuelve a tu flujo.',
      subtitle:
        'Entra con tu cuenta NeuroFlow verificada y mantén la sesión sincronizada con el token Sanctum de la API.',
      formTitle: 'Entrar',
      formSubtitle: 'Usa el email y la contraseña registrados.',
      resetComplete: 'Tu contraseña fue restablecida. Ya puedes entrar con la nueva contraseña.',
      noAccount: '¿Todavía no tienes cuenta?',
    },
    register: {
      eyebrow: 'Empieza protegido',
      title: 'Crea tu cuenta NeuroFlow.',
      subtitle: 'El registro envía una verificación por email antes del acceso autenticado.',
      formTitle: 'Crear cuenta',
      formSubtitle: 'Después del registro, revisa tu email para verificar la cuenta.',
      hasAccount: '¿Ya tienes cuenta?',
    },
    verify: {
      eyebrow: 'Verificación de email',
      title: 'Revisa tu bandeja.',
      subtitle: 'Usa el enlace enviado por la API o solicita un nuevo mensaje aquí.',
      linkTitle: 'Verificando tu email.',
      linkSubtitle: 'Esta página valida el enlace firmado con la API.',
      checking: 'Verificando enlace...',
      formTitle: 'Reenviar email de verificación',
      formSubtitle: 'Ingresa el email que necesita recibir una nueva verificación.',
    },
    forgot: {
      eyebrow: 'Recuperación',
      title: 'Recupera tu contraseña.',
      subtitle: 'Solicita un enlace de reset y continúa el flujo desde la ruta con token.',
      formTitle: 'Enviar enlace de reset',
      formSubtitle: 'La API enviará el enlace de restablecimiento a esta dirección.',
    },
    reset: {
      eyebrow: 'Nueva contraseña',
      title: 'Elige una nueva contraseña.',
      subtitle: 'El token del enlace se envía a la API junto con la nueva contraseña.',
      formTitle: 'Restablecer contraseña',
      formSubtitle: 'Usa el email del enlace de reset y confirma la nueva contraseña.',
    },
    dashboard: {
      eyebrow: 'Autenticado',
      title: 'Hola, {name}.',
      subtitle: 'Esta vista protegida carga después de guardar el bearer token y recibir /user.',
      session: 'Sesión actual',
      verified: 'Verificado',
      unverified: 'No verificado',
      userId: 'ID de usuario',
    },
  },
} as const

export const messages = {
  en: {
    auth: authMessages.en,
    language: {
      label: 'Language',
    },
    nav: {
      label: 'Main',
      modes: 'Modes',
      privacy: 'Privacy',
      howItWorks: 'How it works',
      dashboard: 'Dashboard',
      profileItems: 'Profile navigation',
      account: 'Account',
    },
    hero: {
      tags: {
        openSource: 'Open source',
        browserOnly: 'Runs in browser',
        noTracking: 'No tracking',
      },
      copy: 'Procedural functional music for focus, relaxation, and sleep. An open-source alternative to Brain.fm, with no subscription, no tracking, and no required servers.',
      start: 'Start now',
      engine: 'View the engine',
    },
    player: {
      preview: 'NeuroFlow player preview',
      sessionActive: 'Active session',
      pause: 'Pause preview',
      play: 'Play preview',
      selectMode: 'Select mode',
    },
    modes: {
      focus: {
        label: 'Focus',
        title: 'Deep focus',
        subtitle: 'Discreet beta pulses for distraction-free work blocks.',
        description:
          'Binaural beats and isochronic rhythms calibrated to keep attention steady while the procedural synthesizer creates continuous variation.',
      },
      relax: {
        label: 'Relax',
        title: 'Real relaxation',
        subtitle: 'Theta textures to slow down mental noise.',
        description:
          'Ambient layers, filtered noise, and slow cycles help the body leave alert mode without depending on external streaming.',
      },
      sleep: {
        label: 'Sleep',
        title: 'Real sleep',
        subtitle: 'Delta waves with automatic fade-out for falling asleep.',
        description:
          'Long sessions gradually reduce intensity and stop by themselves, keeping everything local in the browser and away from tracking.',
      },
    },
    modesSection: {
      eyebrow: 'Three mental states',
      title: 'Choose the rhythm for your nervous system.',
      copy: 'Each mode combines a neural band, volume envelopes, textures, and procedural variation to avoid tiring loops.',
    },
    privacy: {
      eyebrow: 'Privacy by design',
      title: 'Functional without becoming one more account to manage.',
      pillars: {
        subscription: {
          title: 'No subscription',
          text: 'The app is designed to run locally, with open code and no monthly paywall.',
        },
        tracking: {
          title: 'No tracking',
          text: 'Sessions, preferences, and history can stay on your device, with no mandatory analytics.',
        },
        server: {
          title: 'No required server',
          text: 'Sound generation happens in the browser using procedural synthesis and versioned presets.',
        },
      },
    },
    process: {
      eyebrow: 'How it works',
      title: 'Procedural synthesis, not an infinite playlist.',
      engineLocal: 'Local engine',
      oscillators: 'Oscillators',
      filters: 'Filters',
      envelopes: 'Envelopes',
      steps: [
        'Choose focus, relaxation, or sleep.',
        'The engine builds layers, pulses, and envelopes in real time.',
        'You adjust duration and intensity without sending data to third parties.',
      ],
    },
    openSource: {
      eyebrow: 'Open source',
      title: 'An alternative you can audit, modify, and host wherever you want.',
      repo: 'View repository',
    },
  },
  ja: {
    auth: authMessages.ja,
    language: {
      label: '言語',
    },
    nav: {
      label: 'メイン',
      modes: 'モード',
      privacy: 'プライバシー',
      howItWorks: '仕組み',
      dashboard: 'ダッシュボード',
      profileItems: 'プロフィールナビゲーション',
      account: 'アカウント',
    },
    hero: {
      tags: {
        openSource: 'オープンソース',
        browserOnly: 'ブラウザで動作',
        noTracking: '追跡なし',
      },
      copy: '集中、リラックス、睡眠のためのプロシージャルな機能音楽。Brain.fm に代わるオープンソースの選択肢で、サブスクも追跡も必須サーバーもありません。',
      start: '今すぐ始める',
      engine: 'エンジンを見る',
    },
    player: {
      preview: 'NeuroFlow プレイヤープレビュー',
      sessionActive: 'アクティブなセッション',
      pause: 'プレビューを一時停止',
      play: 'プレビューを再生',
      selectMode: 'モードを選択',
    },
    modes: {
      focus: {
        label: '集中',
        title: '深い集中',
        subtitle: '作業ブロックを乱さない控えめなベータパルス。',
        description:
          'バイノーラルビートとアイソクロニックリズムで注意を安定させ、プロシージャルシンセが継続的な変化を生み出します。',
      },
      relax: {
        label: 'リラックス',
        title: '本当のリラックス',
        subtitle: '思考のノイズをゆるめるシータ系テクスチャ。',
        description:
          'アンビエントレイヤー、フィルターされたノイズ、ゆっくりした周期で、外部ストリーミングに頼らず警戒状態をほどきます。',
      },
      sleep: {
        label: '睡眠',
        title: '深い睡眠',
        subtitle: '眠りに入るための自動フェード付きデルタ波。',
        description:
          '長めのセッションは少しずつ強度を下げて自動で停止し、すべてをブラウザ内に保ちます。',
      },
    },
    modesSection: {
      eyebrow: '3つのメンタル状態',
      title: '神経系に合うリズムを選ぶ。',
      copy: '各モードは神経帯域、音量エンベロープ、テクスチャ、プロシージャルな変化を組み合わせ、疲れるループを避けます。',
    },
    privacy: {
      eyebrow: 'プライバシー設計',
      title: '管理するアカウントを増やさない機能音楽。',
      pillars: {
        subscription: {
          title: 'サブスクなし',
          text: 'ローカルで動くことを前提にしたオープンコードのアプリで、月額課金の壁はありません。',
        },
        tracking: {
          title: '追跡なし',
          text: 'セッション、設定、履歴はデバイス内に置くことができ、必須の分析はありません。',
        },
        server: {
          title: '必須サーバーなし',
          text: '音の生成はブラウザ内で行われ、プロシージャルシンセとバージョン管理されたプリセットを使います。',
        },
      },
    },
    process: {
      eyebrow: '仕組み',
      title: '無限プレイリストではなく、プロシージャル合成。',
      engineLocal: 'ローカルエンジン',
      oscillators: 'オシレーター',
      filters: 'フィルター',
      envelopes: 'エンベロープ',
      steps: [
        '集中、リラックス、睡眠を選びます。',
        'エンジンがレイヤー、パルス、エンベロープをリアルタイムに構築します。',
        '第三者へデータを送らずに、時間と強度を調整できます。',
      ],
    },
    openSource: {
      eyebrow: 'オープンソース',
      title: '監査、変更、好きな場所でのホストができる代替案。',
      repo: 'リポジトリを見る',
    },
  },
  'pt-BR': {
    auth: authMessages.ptBR,
    language: {
      label: 'Idioma',
    },
    nav: {
      label: 'Principal',
      modes: 'Modos',
      privacy: 'Privacidade',
      howItWorks: 'Como funciona',
      dashboard: 'Dashboard',
      profileItems: 'Navegação do perfil',
      account: 'Conta',
    },
    hero: {
      tags: {
        openSource: 'Open source',
        browserOnly: 'Tudo no browser',
        noTracking: 'Sem tracking',
      },
      copy: 'Música funcional procedural para foco, relaxamento e sono. Uma alternativa open source ao Brain.fm, sem assinatura, sem rastreamento e sem servidores obrigatórios.',
      start: 'Começar agora',
      engine: 'Ver a engine',
    },
    player: {
      preview: 'Prévia do player NeuroFlow',
      sessionActive: 'Sessão ativa',
      pause: 'Pausar prévia',
      play: 'Tocar prévia',
      selectMode: 'Selecionar modo',
    },
    modes: {
      focus: {
        label: 'Foco',
        title: 'Foco profundo',
        subtitle: 'Pulsos beta discretos para blocos de trabalho sem distração.',
        description:
          'Batidas binaurais e ritmos isocrônicos calibrados para manter atenção estável enquanto o sintetizador procedural cria variações contínuas.',
      },
      relax: {
        label: 'Relaxar',
        title: 'Relaxamento real',
        subtitle: 'Texturas theta para desacelerar o ruído mental.',
        description:
          'Camadas ambientes, ruído filtrado e ciclos lentos ajudam o corpo a sair do estado de alerta sem depender de streaming externo.',
      },
      sleep: {
        label: 'Sono',
        title: 'Sono de verdade',
        subtitle: 'Ondas delta com fade automático para adormecer.',
        description:
          'Sessões longas reduzem intensidade aos poucos e encerram sozinhas, mantendo tudo local no browser e longe de rastreamento.',
      },
    },
    modesSection: {
      eyebrow: 'Três estados mentais',
      title: 'Escolha o ritmo do seu sistema nervoso.',
      copy: 'Cada modo combina uma faixa neural, envelopes de volume, texturas e variação procedural para evitar loops cansativos.',
    },
    privacy: {
      eyebrow: 'Privacidade por design',
      title: 'Funcional sem virar mais uma conta para gerenciar.',
      pillars: {
        subscription: {
          title: 'Sem assinatura',
          text: 'O app nasce para rodar localmente, com código aberto e sem bloqueio por mensalidade.',
        },
        tracking: {
          title: 'Sem rastreamento',
          text: 'Sessões, preferências e histórico podem ficar no seu dispositivo, sem analytics obrigatórios.',
        },
        server: {
          title: 'Sem servidor obrigatório',
          text: 'A geração sonora acontece no browser, usando síntese procedural e presets versionados.',
        },
      },
    },
    process: {
      eyebrow: 'Como funciona',
      title: 'Síntese procedural, não playlist infinita.',
      engineLocal: 'Engine local',
      oscillators: 'Osciladores',
      filters: 'Filtros',
      envelopes: 'Envelopes',
      steps: [
        'Escolha foco, relaxamento ou sono.',
        'A engine monta camadas, pulsos e envelopes em tempo real.',
        'Você ajusta duração e intensidade sem enviar dados para terceiros.',
      ],
    },
    openSource: {
      eyebrow: 'Código aberto',
      title: 'Uma alternativa que você pode auditar, modificar e hospedar onde quiser.',
      repo: 'Ver repositório',
    },
  },
  es: {
    auth: authMessages.es,
    language: {
      label: 'Idioma',
    },
    nav: {
      label: 'Principal',
      modes: 'Modos',
      privacy: 'Privacidad',
      howItWorks: 'Cómo funciona',
      dashboard: 'Dashboard',
      profileItems: 'Navegación del perfil',
      account: 'Cuenta',
    },
    hero: {
      tags: {
        openSource: 'Open source',
        browserOnly: 'Todo en el navegador',
        noTracking: 'Sin tracking',
      },
      copy: 'Música funcional procedural para foco, relajación y sueño. Una alternativa open source a Brain.fm, sin suscripción, sin rastreo y sin servidores obligatorios.',
      start: 'Empezar ahora',
      engine: 'Ver la engine',
    },
    player: {
      preview: 'Vista previa del reproductor NeuroFlow',
      sessionActive: 'Sesión activa',
      pause: 'Pausar vista previa',
      play: 'Reproducir vista previa',
      selectMode: 'Seleccionar modo',
    },
    modes: {
      focus: {
        label: 'Foco',
        title: 'Foco profundo',
        subtitle: 'Pulsos beta discretos para bloques de trabajo sin distracciones.',
        description:
          'Batidos binaurales y ritmos isocrónicos calibrados para mantener la atención estable mientras el sintetizador procedural crea variación continua.',
      },
      relax: {
        label: 'Relajar',
        title: 'Relajación real',
        subtitle: 'Texturas theta para desacelerar el ruido mental.',
        description:
          'Capas ambientales, ruido filtrado y ciclos lentos ayudan al cuerpo a salir del estado de alerta sin depender de streaming externo.',
      },
      sleep: {
        label: 'Sueño',
        title: 'Sueño real',
        subtitle: 'Ondas delta con fade automático para dormirte.',
        description:
          'Las sesiones largas reducen la intensidad poco a poco y se detienen solas, manteniendo todo local en el navegador y lejos del rastreo.',
      },
    },
    modesSection: {
      eyebrow: 'Tres estados mentales',
      title: 'Elige el ritmo de tu sistema nervioso.',
      copy: 'Cada modo combina una banda neural, envolventes de volumen, texturas y variación procedural para evitar loops cansadores.',
    },
    privacy: {
      eyebrow: 'Privacidad por diseño',
      title: 'Funcional sin convertirse en otra cuenta que administrar.',
      pillars: {
        subscription: {
          title: 'Sin suscripción',
          text: 'La app nace para ejecutarse localmente, con código abierto y sin bloqueo por mensualidad.',
        },
        tracking: {
          title: 'Sin rastreo',
          text: 'Sesiones, preferencias e historial pueden quedarse en tu dispositivo, sin analytics obligatorios.',
        },
        server: {
          title: 'Sin servidor obligatorio',
          text: 'La generación sonora ocurre en el navegador usando síntesis procedural y presets versionados.',
        },
      },
    },
    process: {
      eyebrow: 'Cómo funciona',
      title: 'Síntesis procedural, no una playlist infinita.',
      engineLocal: 'Engine local',
      oscillators: 'Osciladores',
      filters: 'Filtros',
      envelopes: 'Envolventes',
      steps: [
        'Elige foco, relajación o sueño.',
        'La engine monta capas, pulsos y envolventes en tiempo real.',
        'Ajustas duración e intensidad sin enviar datos a terceros.',
      ],
    },
    openSource: {
      eyebrow: 'Código abierto',
      title: 'Una alternativa que puedes auditar, modificar y alojar donde quieras.',
      repo: 'Ver repositorio',
    },
  },
} as const

const isSupportedLocale = (value: string | null | undefined): value is Locale =>
  supportedLocales.some((locale) => locale.code === value)

const normalizeLocale = (value: string | null | undefined): Locale | undefined => {
  const normalized = value?.toLowerCase()

  if (!normalized) return undefined
  if (normalized.startsWith('pt')) return 'pt-BR'
  if (normalized.startsWith('ja') || normalized.startsWith('jp')) return 'ja'
  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('en')) return 'en'

  return undefined
}

const storedLocale =
  typeof localStorage === 'undefined' ? undefined : localStorage.getItem(STORAGE_KEY)
const browserLocale = typeof navigator === 'undefined' ? undefined : navigator.language

export const initialLocale =
  normalizeLocale(storedLocale) ?? normalizeLocale(browserLocale) ?? 'pt-BR'

export const persistLocale = (locale: Locale) => {
  if (!isSupportedLocale(locale) || typeof localStorage === 'undefined') return

  localStorage.setItem(STORAGE_KEY, locale)
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages,
})
