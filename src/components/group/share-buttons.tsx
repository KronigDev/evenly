'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ShareNetwork, WhatsappLogo } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export interface ShareButtonsProps {
  url: string;
  groupName: string;
}

/** Copy / WhatsApp / native-share row for an invite link. */
export function ShareButtons({ url, groupName }: ShareButtonsProps) {
  const t = useTranslations('invites');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const message = t('whatsappMessage', { group: groupName, url });

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for browsers without the async clipboard API.
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      toast.success(t('linkCopied'));
    } catch {
      toast.error(tc('somethingWentWrong'));
    }
  }

  function shareWhatsApp() {
    const target = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: groupName, text: message, url });
    } catch {
      // User cancelled the share sheet — nothing to do.
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          aria-label={t('copyLink')}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs"
        />
        <Button
          variant="secondary"
          leftIcon={<Copy size={16} />}
          onClick={copyLink}
          className="shrink-0"
        >
          {tc('copy')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          leftIcon={<WhatsappLogo size={16} weight="fill" className="text-[#25D366]" />}
          onClick={shareWhatsApp}
        >
          {t('shareWhatsapp')}
        </Button>
        {canNativeShare ? (
          <Button variant="outline" leftIcon={<ShareNetwork size={16} />} onClick={nativeShare}>
            {tc('share')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
