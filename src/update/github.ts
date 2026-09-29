import Constants from 'expo-constants';
import type { Publicacion } from '../domain/actualizacion';

/**
 * Consulta la publicación de GitHub donde vive el APK.
 *
 * Es la única llamada de red de toda la app. No manda nada —es un GET a una
 * URL pública— y si falla no pasa nada: sin respuesta simplemente no se
 * ofrece actualizar, nunca se muestra un error por esto. La política de
 * privacidad lo dice con todas las letras.
 */
const PUBLICACION =
  'https://api.github.com/repos/agustinaromanella1-ops/Take-it-easy-/releases/tags/apk-listo-para-enviar';

/** Cuándo se compiló esta app. La graba el workflow antes de compilar. */
export function compiladaEn(): string | null {
  const valor = Constants.expoConfig?.extra?.['buildTime'];
  return typeof valor === 'string' ? valor : null;
}

export async function buscarPublicacion(): Promise<Publicacion | null> {
  try {
    // Sin corte, en una red mala la promesa queda colgada y el cartel de
    // "buscando" no se apaga nunca.
    const respuesta = await fetch(PUBLICACION, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!respuesta.ok) return null;

    const datos: unknown = await respuesta.json();
    if (typeof datos !== 'object' || datos === null) return null;

    const r = datos as Record<string, unknown>;
    const assets = Array.isArray(r['assets']) ? r['assets'] : [];

    const apk = assets.find((a): a is Record<string, unknown> => {
      if (typeof a !== 'object' || a === null) return false;
      const nombre = (a as Record<string, unknown>)['name'];
      return typeof nombre === 'string' && nombre.endsWith('.apk');
    });

    if (!apk || typeof apk['updated_at'] !== 'string') return null;

    return {
      publicadoEn: apk['updated_at'],
      url: typeof r['html_url'] === 'string' ? r['html_url'] : PUBLICACION,
    };
  } catch {
    // Sin internet, con la API caída o con una respuesta rara: no se ofrece
    // nada y la app sigue funcionando igual.
    return null;
  }
}
