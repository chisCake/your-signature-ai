import { Badge } from '@/components/ui/badge';
import { Signature, SignatureGenuine } from '@/lib/types';
import React from 'react';

export class BadgeFactory {
  static authenticity(signature: Signature): React.ReactElement {
    const isGenuine = signature.type === 'genuine';
    return isGenuine ? (
      <Badge variant='default' tooltip='Подпись является настоящей'>
        Настоящая
      </Badge>
    ) : (
      <Badge variant='default' tooltip='Подпись является поддельной'>
        Поддельная
      </Badge>
    );
  }

  static userForForgery(signature: SignatureGenuine): React.ReactElement {
    const userForForgery = signature.user_for_forgery ?? false;
    return userForForgery ? (
      <Badge
        variant='green'
        tooltip='Разрешено использование как примера для подделки'
      >
        Публичная
      </Badge>
    ) : (
      <Badge
        variant='yellow'
        tooltip='Запрещено использование как примера для подделки'
      >
        Скрыта пользователем
      </Badge>
    );
  }

  static modForForgery(signature: SignatureGenuine): React.ReactElement {
    const modForForgery = signature.mod_for_forgery ?? false;
    return modForForgery ? (
      <Badge
        variant='green'
        tooltip='Разрешено использование как примера для подделки'
      >
        Публичная
      </Badge>
    ) : (
      <Badge
        variant='red'
        tooltip='Запрещено использование как примера для подделки модератором'
      >
        Скрыта модератором
      </Badge>
    );
  }

  static modForDataset(
    signature: Signature,
    showInDataset: boolean = false
  ): React.ReactElement {
    const modForDataset = signature.data.mod_for_dataset ?? false;
    return modForDataset ? (
      showInDataset ? (
        <Badge variant='green' tooltip='Подпись участвует в датасете'>
          В датасете
        </Badge>
      ) : (
        <></>
      )
    ) : (
      <Badge variant='red' tooltip='Подпись не участвует в датасете'>
        Не в датасете
      </Badge>
    );
  }
}
