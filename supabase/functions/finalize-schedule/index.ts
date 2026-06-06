Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  return Response.json(
    {
      message:
        'Schedule finalization is scaffolded but not implemented yet. The next slice will persist confirmed schedule drafts.',
    },
    { status: 501 }
  );
});
